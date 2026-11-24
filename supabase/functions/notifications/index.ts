// Sends Minders notifications. A database job calls it every minute with {"action":"tick"}.
// Calling it is harmless: each notification is recorded and only ever sent once.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import {
  digestDue,
  digestMessage,
  type Message,
  openTasksFor,
  type ReminderData,
  reminderMessage,
  reminderTimesDue,
  type Subscription,
  taskAlertsDue,
  type TaskData,
  taskMessage,
  testMessage,
} from "./due.ts";

/** Push services may contact this address about problems. It is the app's own site, not a personal email. */
const CONTACT = "https://minders-r7k2q9x.pages.dev";
const TEST_COOLDOWN_SECONDS = 20;
/** How long a push service keeps trying to deliver to a phone that is off. */
const TTL_SECONDS = 60 * 60 * 4;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function database() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Loads the VAPID keys, creating them the first time. The private key never leaves the database. */
async function vapidKeys(db: SupabaseClient) {
  const { data, error } = await db.from("push_config").select("vapid").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (data) return await webpush.importVapidKeys(data.vapid);

  const created = await webpush.exportVapidKeys(await webpush.generateVapidKeys({ extractable: true }));
  const { error: insertError } = await db.from("push_config").upsert({ id: 1, vapid: created }, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) throw insertError;
  // Another call may have created keys at the same moment, so read back whichever was kept.
  const { data: kept, error: readError } = await db.from("push_config").select("vapid").eq("id", 1).single();
  if (readError) throw readError;
  return await webpush.importVapidKeys(kept.vapid);
}

type Sender = (sub: Subscription, message: Message) => Promise<"sent" | "gone" | "failed">;

async function makeSender(db: SupabaseClient): Promise<Sender> {
  const appServer = await webpush.ApplicationServer.new({ contactInformation: CONTACT, vapidKeys: await vapidKeys(db) });
  return async (sub, message) => {
    try {
      await appServer.subscribe(sub.subscription).pushTextMessage(JSON.stringify(message), {
        ttl: TTL_SECONDS,
        urgency: webpush.Urgency.High,
      });
      return "sent";
    } catch (error) {
      if (error instanceof webpush.PushMessageError && [404, 410].includes(error.response.status)) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        return "gone";
      }
      console.error("push failed", String(error));
      return "failed";
    }
  };
}

async function tick(db: SupabaseClient, now: Date) {
  const { data: subs, error } = await db.from("push_subscriptions").select("*");
  if (error) throw error;
  if (!subs?.length) return { subscriptions: 0, sent: 0 };

  const { data: rows, error: itemsError } = await db
    .from("items")
    .select("kind, data, user_id")
    .in("kind", ["task", "reminder", "module"])
    .eq("deleted", false);
  if (itemsError) throw itemsError;

  // Each device only ever gets its own account's tasks and reminders.
  const tasksOf = (userId: string) => rows.filter((row) => row.kind === "task" && row.user_id === userId).map((row) => row.data as TaskData);
  const reminders = rows
    .filter((row) => row.kind === "reminder")
    .map((row) => ({ ...(row.data as ReminderData), userId: row.user_id as string }));
  const moduleNames = new Map(rows.filter((row) => row.kind === "module").map((row) => [row.data.id, row.data.name]));
  const send = await makeSender(db);
  let sent = 0;

  // Reminders: claim each one first, so two overlapping runs never send it twice.
  const due = reminders.flatMap((reminder) => reminderTimesDue(reminder, now).map((fireAt) => ({ reminder, fireAt })));
  if (due.length) {
    const { data: claimed, error: claimError } = await db
      .from("push_sent")
      .upsert(due.map(({ reminder, fireAt }) => ({ item_id: reminder.id, fire_at: fireAt })), {
        onConflict: "item_id,fire_at",
        ignoreDuplicates: true,
      })
      .select("item_id");
    if (claimError) throw claimError;
    const claimedIds = new Set((claimed ?? []).map((row) => row.item_id));
    for (const { reminder } of due.filter(({ reminder }) => claimedIds.has(reminder.id))) {
      for (const sub of subs.filter((item: Subscription) => item.reminders_enabled && item.user_id === reminder.userId)) {
        if ((await send(sub, reminderMessage(reminder, moduleNames.get(reminder.moduleId)))) === "sent") sent++;
      }
    }
  }

  // Task times: each device gets each one once, at that time on its own clock.
  for (const sub of (subs as Subscription[]).filter((item) => item.reminders_enabled)) {
    const due = taskAlertsDue(tasksOf(sub.user_id), sub, now);
    if (!due.length) continue;
    const key = (task: TaskData) => `task:${task.id}:${task.day}T${task.remindTime}:${sub.endpoint}`;
    const { data: claimed, error: claimError } = await db
      .from("push_sent")
      // The key already holds the task's day and time, so fire_at is a fixed value.
      .upsert(due.map((task) => ({ item_id: key(task), fire_at: "1970-01-01T00:00:00Z" })), {
        onConflict: "item_id,fire_at",
        ignoreDuplicates: true,
      })
      .select("item_id");
    if (claimError) throw claimError;
    const claimedKeys = new Set((claimed ?? []).map((row) => row.item_id));
    for (const task of due.filter((item) => claimedKeys.has(key(item)))) {
      if ((await send(sub, taskMessage(task))) === "sent") sent++;
    }
  }

  // Morning summary, once per device per local day.
  for (const sub of subs as Subscription[]) {
    const date = digestDue(sub, now);
    if (!date) continue;
    const { data: claimed } = await db
      .from("push_subscriptions")
      .update({ last_digest_date: date })
      .eq("endpoint", sub.endpoint)
      .or(`last_digest_date.is.null,last_digest_date.neq.${date}`)
      .select("endpoint");
    if (!claimed?.length) continue;
    const open = openTasksFor(tasksOf(sub.user_id), date);
    if (open.length && (await send(sub, digestMessage(open))) === "sent") sent++;
  }

  return { subscriptions: subs.length, sent };
}

async function sendTest(db: SupabaseClient, endpoint: string, now: Date) {
  const { data: sub } = await db.from("push_subscriptions").select("*").eq("endpoint", endpoint).maybeSingle();
  if (!sub) return json({ error: "This device isn't signed up for notifications yet." }, 404);
  if (sub.last_test_at && now.getTime() - new Date(sub.last_test_at).getTime() < TEST_COOLDOWN_SECONDS * 1000) {
    return json({ error: "Wait a few seconds before sending another test." }, 429);
  }
  await db.from("push_subscriptions").update({ last_test_at: now.toISOString() }).eq("endpoint", endpoint);
  const result = await (await makeSender(db))(sub, testMessage());
  return result === "sent" ? json({ ok: true }) : json({ error: "The phone's push service refused the test." }, 502);
}

export async function handle(request: Request, db: SupabaseClient = database(), now = new Date()) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (request.method === "GET") {
      return json({ publicKey: await webpush.exportApplicationServerKey(await vapidKeys(db)) });
    }
    const body = await request.json().catch(() => ({}));
    if (body.action === "tick") return json(await tick(db, now));
    if (body.action === "test" && typeof body.endpoint === "string") return await sendTest(db, body.endpoint, now);
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(String(error));
    return json({ error: "Something went wrong" }, 500);
  }
}

// Tests import this file to call handle() directly, without starting a server.
if (!Deno.env.get("MINDERS_TEST")) Deno.serve((request) => handle(request));
