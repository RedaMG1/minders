// Runs the whole function against an in-memory database and a local push service,
// then decrypts each notification the way a phone would.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { decodeBase64Url, encodeBase64Url } from "jsr:@std/encoding@1/base64url";

Deno.env.set("MINDERS_TEST", "1");
const { handle } = await import("./index.ts");

type Row = Record<string, unknown>;

/** Just enough of the Supabase query builder for this function, kept in memory. */
function fakeDatabase(tables: Record<string, Row[]>) {
  class Query {
    private filters: ((row: Row) => boolean)[] = [];
    private action: "select" | "upsert" | "update" | "delete" = "select";
    private payload: Row[] | Row = [];
    private options: { onConflict?: string; ignoreDuplicates?: boolean } = {};
    private oneRow = false;
    // Like the real API, a select returns at most 1000 rows unless a range asks for others.
    private window: [number, number] = [0, 999];
    constructor(private table: string) {
      tables[table] ??= [];
    }
    select() { return this; }
    eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
    in(column: string, values: unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
    range(from: number, to: number) { this.window = [from, to]; return this; }
    order() { return this; }
    or(expression: string) {
      const read = (row: Row, column: string) =>
        column.includes("->>") ? String((row[column.split("->>")[0]] as Row)?.[column.split("->>")[1]] ?? "") : row[column];
      const tests = expression.split(",").map((part) => {
        const [column, operator, ...rest] = part.split(".");
        const value = rest.join(".");
        if (operator === "is") return (row: Row) => read(row, column) == null;
        if (operator === "eq") return (row: Row) => String(read(row, column)) === value;
        return (row: Row) => read(row, column) !== value;
      });
      this.filters.push((row) => tests.some((test) => test(row)));
      return this;
    }
    upsert(rows: Row[] | Row, options = {}) { this.action = "upsert"; this.payload = rows; this.options = options; return this; }
    update(values: Row) { this.action = "update"; this.payload = values; return this; }
    delete() { this.action = "delete"; return this; }
    maybeSingle() { this.oneRow = true; return this; }
    single() { this.oneRow = true; return this; }
    then(done: (value: { data: unknown; error: null }) => unknown, failed?: (reason: unknown) => unknown) {
      return Promise.resolve(this.run()).then(done, failed);
    }
    private matches() { return tables[this.table].filter((row) => this.filters.every((filter) => filter(row))); }
    private run() {
      const rows = tables[this.table];
      let data: Row[] = [];
      if (this.action === "select") data = this.matches().slice(this.window[0], this.window[1] + 1);
      if (this.action === "update") data = this.matches().map((row) => Object.assign(row, this.payload));
      if (this.action === "delete") {
        data = this.matches();
        tables[this.table] = rows.filter((row) => !data.includes(row));
      }
      if (this.action === "upsert") {
        const keys = (this.options.onConflict ?? "id").split(",");
        for (const row of [this.payload].flat() as Row[]) {
          const existing = rows.find((other) => keys.every((key) => other[key] === row[key]));
          if (existing && this.options.ignoreDuplicates) continue;
          if (existing) Object.assign(existing, row);
          else rows.push({ ...row });
          data.push(row);
        }
      }
      if (this.oneRow) return { data: data[0] ?? null, error: null };
      return { data, error: null };
    }
  }
  return { from: (table: string) => new Query(table) };
}

/** A phone: its push keys, and a way to read what it received. */
async function makePhone(endpoint: string) {
  const keys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", keys.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const hkdf = async (salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) => {
    const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
  };
  const text = (value: string) => new TextEncoder().encode(value);
  const join = (...parts: Uint8Array<ArrayBuffer>[]) => {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  };
  return {
    subscription: { endpoint, keys: { p256dh: encodeBase64Url(publicRaw), auth: encodeBase64Url(auth) } },
    /** Decrypts an aes128gcm push body (RFC 8188 and RFC 8291). */
    async read(body: Uint8Array<ArrayBuffer>) {
      const salt = body.slice(0, 16);
      const idLength = body[20];
      const serverPublicRaw = body.slice(21, 21 + idLength);
      const cipher = body.slice(21 + idLength);
      const serverPublic = await crypto.subtle.importKey("raw", serverPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
      const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: serverPublic }, keys.privateKey, 256));
      const ikm = await hkdf(auth, shared, join(text("WebPush: info\0"), publicRaw, serverPublicRaw), 32);
      const cek = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 16);
      const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 12);
      const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, cipher));
      return JSON.parse(new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2))));
    },
  };
}

Deno.test("sends reminders and the morning summary, once, encrypted for the phone", async () => {
  const received: { path: string; headers: Headers; body: Uint8Array<ArrayBuffer> }[] = [];
  const server = Deno.serve({ port: 4291, onListen: () => {} }, async (request) => {
    const path = new URL(request.url).pathname;
    received.push({ path, headers: request.headers, body: new Uint8Array(await request.arrayBuffer()) });
    return new Response(null, { status: path.endsWith("/gone") ? 410 : 201 });
  });

  try {
    const phone = await makePhone("http://localhost:4291/push/phone");
    const oldPhone = await makePhone("http://localhost:4291/push/gone");
    const sub = (endpoint: string, subscription: unknown, user_id = "me") => ({
      endpoint, subscription, user_id, timezone: "Europe/Paris", digest_time: "08:00",
      digest_enabled: true, reminders_enabled: true, last_digest_date: null, last_test_at: null,
    });
    const tables: Record<string, Row[]> = {
      push_config: [],
      push_sent: [],
      push_subscriptions: [sub(phone.subscription.endpoint, phone.subscription), sub(oldPhone.subscription.endpoint, oldPhone.subscription)],
      items: [
        { kind: "module", deleted: false, user_id: "me", data: { id: "m1", name: "Home bills" } },
        { kind: "reminder", deleted: false, user_id: "me", data: { id: "r1", moduleId: "m1", title: "Pay rent", at: "2026-11-13T07:00:00Z", repeat: "monthly" } },
        { kind: "task", deleted: false, user_id: "me", data: { id: "t1", title: "Buy bread", day: "2026-11-13", done: false, createdAt: "2026-11-12T08:00:00Z" } },
        { kind: "task", deleted: false, user_id: "me", data: { id: "t2", title: "Call the bank", day: "2026-11-12", done: false, createdAt: "2026-11-11T08:00:00Z" } },
        { kind: "task", deleted: false, user_id: "me", data: { id: "t3", title: "Already done", day: "2026-11-13", done: true, createdAt: "2026-11-12T09:00:00Z" } },
        { kind: "task", deleted: false, user_id: "someone-else", data: { id: "t5", title: "Not my task", day: "2026-11-13", done: false, createdAt: "2026-11-12T09:00:00Z" } },
        { kind: "reminder", deleted: false, user_id: "someone-else", data: { id: "r2", moduleId: "m1", title: "Not my reminder", at: "2026-11-13T07:00:00Z", repeat: "none" } },
        { kind: "task", deleted: true, user_id: "me", data: { id: "t4", title: "Deleted", day: "2026-11-13", done: false, createdAt: "2026-11-12T09:00:00Z" } },
      ],
    };
    // deno-lint-ignore no-explicit-any
    const db = fakeDatabase(tables) as any;
    const at = new Date("2026-11-13T07:00:30Z"); // 08:00:30 in Paris
    const tick = () => new Request("http://function", { method: "POST", body: JSON.stringify({ action: "tick" }) });

    const keyResponse = await (await handle(new Request("http://function"), db, at)).json();
    if (!keyResponse.publicKey) console.log("key response", keyResponse);
    assert(typeof keyResponse.publicKey === "string" && keyResponse.publicKey.length > 80, "public key is served");
    assertEquals(decodeBase64Url(keyResponse.publicKey).length, 65);
    assertEquals(tables.push_config.length, 1, "keys are created once and stored");

    const first = await (await handle(tick(), db, at)).json();
    const toPhone = received.filter((push) => push.path === "/push/phone");
    assertEquals(first.sent, 2, "a reminder and a summary go to the phone");
    const messages = await Promise.all(toPhone.map((push) => phone.read(push.body)));
    assertEquals(messages.map((m) => m.title).sort(), ["Pay rent", "Today: 2 tasks"], "another account's task and reminder are never included");
    assertEquals(messages.find((m) => m.title === "Pay rent").body, "Reminder from Home bills");
    assertEquals(messages.find((m) => m.title.startsWith("Today")).body, "Call the bank, Buy bread");

    const push = toPhone[0];
    assertEquals(push.headers.get("content-encoding"), "aes128gcm");
    assertEquals(push.headers.get("urgency"), "high");
    assertEquals(push.headers.get("ttl"), String(60 * 60 * 4));
    assert(push.headers.get("authorization")?.includes(`k=${keyResponse.publicKey}`), "signed with the same key the app subscribes with");
    assertEquals(tables.push_subscriptions.map((row) => row.endpoint), [phone.subscription.endpoint], "a phone that unsubscribed is removed");

    const second = await (await handle(tick(), db, new Date("2026-11-13T07:01:30Z"))).json();
    assertEquals(second.sent, 0, "nothing is sent twice");

    const test = await handle(new Request("http://function", { method: "POST", body: JSON.stringify({ action: "test", endpoint: phone.subscription.endpoint }) }), db, at);
    assertEquals(test.status, 200);
    assertEquals((await phone.read(received.at(-1)!.body)).title, "Notifications are on");
    const tooSoon = await handle(new Request("http://function", { method: "POST", body: JSON.stringify({ action: "test", endpoint: phone.subscription.endpoint }) }), db, at);
    assertEquals(tooSoon.status, 429);
    const unknown = await handle(new Request("http://function", { method: "POST", body: JSON.stringify({ action: "test", endpoint: "https://elsewhere" }) }), db, at);
    assertEquals(unknown.status, 404);
    assertEquals((await handle(new Request("http://function", { method: "OPTIONS" }), db, at)).headers.get("access-control-allow-origin"), "*");
  } finally {
    await server.shutdown();
  }
});

Deno.test("sends a task's time to each of the account's phones, once", async () => {
  const received: { path: string; body: Uint8Array<ArrayBuffer> }[] = [];
  const server = Deno.serve({ port: 4292, onListen: () => {} }, async (request) => {
    received.push({ path: new URL(request.url).pathname, body: new Uint8Array(await request.arrayBuffer()) });
    return new Response(null, { status: 201 });
  });
  try {
    const phone = await makePhone("http://localhost:4292/push/phone");
    const tablet = await makePhone("http://localhost:4292/push/tablet");
    const stranger = await makePhone("http://localhost:4292/push/stranger");
    const sub = (endpoint: string, subscription: unknown, user_id: string) => ({
      endpoint, subscription, user_id, timezone: "Europe/Paris", digest_time: "08:00",
      digest_enabled: false, reminders_enabled: true, last_digest_date: null, last_test_at: null,
    });
    const tables: Record<string, Row[]> = {
      push_config: [],
      push_sent: [],
      push_subscriptions: [
        sub(phone.subscription.endpoint, phone.subscription, "me"),
        sub(tablet.subscription.endpoint, tablet.subscription, "me"),
        sub(stranger.subscription.endpoint, stranger.subscription, "someone-else"),
      ],
      items: [
        { kind: "task", deleted: false, user_id: "me", data: { id: "t1", title: "Call the bank", day: "2026-11-24", done: false, remindTime: "15:00", createdAt: "2026-11-24T08:00:00Z" } },
      ],
    };
    // deno-lint-ignore no-explicit-any
    const db = fakeDatabase(tables) as any;
    const tick = (at: string) => handle(new Request("http://function", { method: "POST", body: JSON.stringify({ action: "tick" }) }), db, new Date(at));

    const first = await (await tick("2026-11-24T14:00:20Z")).json();
    assertEquals(first.sent, 2, "both of my devices get it");
    assertEquals(received.map((push) => push.path).sort(), ["/push/phone", "/push/tablet"], "another account's device gets nothing");
    const message = await phone.read(received.find((push) => push.path === "/push/phone")!.body);
    assertEquals(message, { title: "Call the bank", body: "Planned for now", url: "/today", tag: "minders-task-t1" });

    const again = await (await tick("2026-11-24T14:01:20Z")).json();
    assertEquals(again.sent, 0, "nothing is sent twice");
  } finally {
    await server.shutdown();
  }
});

Deno.test("task times still go out with thousands of rows and one phone with a broken time zone", async () => {
  const received: string[] = [];
  const server = Deno.serve({ port: 4293, onListen: () => {} }, async (request) => {
    received.push(new URL(request.url).pathname);
    await request.arrayBuffer();
    return new Response(null, { status: 201 });
  });
  try {
    const broken = await makePhone("http://localhost:4293/push/broken");
    const phone = await makePhone("http://localhost:4293/push/phone");
    const sub = (endpoint: string, subscription: unknown, timezone: string) => ({
      endpoint, subscription, user_id: "me", timezone, digest_time: "08:00",
      digest_enabled: true, reminders_enabled: true, last_digest_date: null, last_test_at: null,
    });
    // 1200 finished tasks come first, the way History keeps them.
    const done = Array.from({ length: 1200 }, (_, i) => ({
      kind: "task", deleted: false, user_id: "me",
      data: { id: `old${i}`, title: `Old ${i}`, day: "2026-10-01", done: true, createdAt: "2026-10-01T08:00:00Z" },
    }));
    const tables: Record<string, Row[]> = {
      push_config: [],
      push_sent: [],
      push_subscriptions: [sub(broken.subscription.endpoint, broken.subscription, "Not/AZone"), sub(phone.subscription.endpoint, phone.subscription, "Europe/Paris")],
      items: [
        ...done,
        { kind: "task", deleted: false, user_id: "me", data: { id: "t1", title: "Call the bank", day: "2026-11-24", done: false, remindTime: "15:00", createdAt: "2026-11-24T08:00:00Z" } },
      ],
    };
    // deno-lint-ignore no-explicit-any
    const db = fakeDatabase(tables) as any;
    const response = await handle(new Request("http://function", { method: "POST", body: JSON.stringify({ action: "tick" }) }), db, new Date("2026-11-24T14:00:20Z"));
    assertEquals(response.status, 200, "one broken phone doesn't stop the run");
    assertEquals(received, ["/push/phone"], "the task past the first 1000 rows still reaches the working phone");
  } finally {
    await server.shutdown();
  }
});
