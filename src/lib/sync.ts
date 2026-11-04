import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppState, Module, Note, Reminder, Task } from "./types";

// The device keeps working on its own copy. Each edit goes into a queue saved on the
// device, and the queue uploads whenever there is internet, so nothing is lost offline.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Tracked per project, so pointing the app at a new database uploads this device's data to it.
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
const CURSOR_KEY = `minders-sync-cursor:${projectRef}`;
const SEEDED_KEY = `minders-sync-seeded:${projectRef}`;
const OUTBOX_KEY = "minders-outbox";
const DEVICE_KEY = "minders-device";
const TABLE = "items";
const UPLOAD_DELAY_MS = 1000;
const REFRESH_SECONDS = 30;
const RETRY_SECONDS = 15;
const PAGE_SIZE = 1000;
/** Fetches a little further back than needed, so a slow upload from another device is never skipped. */
const CURSOR_OVERLAP_MS = 60 * 1000;

export type Kind = "module" | "note" | "reminder" | "task";
export type SyncedRecord = Module | Note | Reminder | Task;

export type ItemRow = {
  id: string;
  kind: Kind;
  data: SyncedRecord;
  deleted: boolean;
  changed_at: string;
  device: string;
};

export type SyncStatus = "off" | "saving" | "saved" | "offline";

export const COLLECTIONS = [
  ["module", "modules"],
  ["note", "notes"],
  ["reminder", "reminders"],
  ["task", "tasks"],
] as const;

type SyncHandlers = {
  getState: () => AppState;
  applyRemote: (rows: ItemRow[], isNewer: (row: ItemRow) => boolean) => void;
  onStatusChange: () => void;
};

let client: SupabaseClient | null = null;
let handlers: SyncHandlers | null = null;
let outbox: Record<string, ItemRow> = {};
let status: SyncStatus = supabaseUrl && supabaseKey ? "saving" : "off";
let uploadTimer: ReturnType<typeof setTimeout> | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let running = false;
let runAgain = false;

function readJson<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveOutbox() {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    // The edit is still in memory and stays in the queue for this session.
  }
}

function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  handlers?.onStatusChange();
}

export const getSyncStatus = () => status;
export const pendingChanges = () => Object.keys(outbox).length;

function enqueue(kind: Kind, record: SyncedRecord, deleted: boolean, changedAt: string) {
  outbox[record.id] = { id: record.id, kind, data: record, deleted, changed_at: changedAt, device: deviceId() };
}

/** Queues everything that differs between two versions of the saved data. */
export function trackChanges(previous: AppState, next: AppState) {
  if (status === "off") return;
  const changedAt = new Date().toISOString();
  let changed = false;

  for (const [kind, key] of COLLECTIONS) {
    if (previous[key] === next[key]) continue;
    const before = new Map<string, SyncedRecord>(previous[key].map((record) => [record.id, record]));
    const after = new Set<string>();
    for (const record of next[key]) {
      after.add(record.id);
      const old = before.get(record.id);
      if (old === record || (old && JSON.stringify(old) === JSON.stringify(record))) continue;
      enqueue(kind, record, false, changedAt);
      changed = true;
    }
    for (const [id, record] of before) {
      if (after.has(id)) continue;
      enqueue(kind, record, true, changedAt);
      changed = true;
    }
  }

  if (changed) {
    saveOutbox();
    setStatus("saving");
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(syncNow, UPLOAD_DELAY_MS);
  }
}

/** The first time this device connects, everything already on it goes into the queue. */
function seedFromDevice() {
  if (localStorage.getItem(SEEDED_KEY) || !handlers) return;
  const data = handlers.getState();
  for (const [kind, key] of COLLECTIONS) {
    for (const record of data[key]) {
      if (outbox[record.id]) continue;
      const stamped = record as { updatedAt?: string; createdAt?: string };
      enqueue(kind, record, false, stamped.updatedAt ?? stamped.createdAt ?? new Date().toISOString());
    }
  }
  saveOutbox();
  localStorage.setItem(SEEDED_KEY, "1");
}

async function upload(supabase: SupabaseClient) {
  const rows = Object.values(outbox);
  if (!rows.length) return;
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });
  if (error) throw error;
  // Keeps anything edited again while this upload was on its way.
  for (const row of rows) {
    if (outbox[row.id]?.changed_at === row.changed_at) delete outbox[row.id];
  }
  saveOutbox();
}

async function download(supabase: SupabaseClient) {
  let cursor = localStorage.getItem(CURSOR_KEY) ?? "1970-01-01T00:00:00Z";
  const since = new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString();
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, kind, data, deleted, changed_at, device, synced_at")
      .gte("synced_at", since)
      .order("synced_at")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const rows = data as (ItemRow & { synced_at: string })[];
    // An edit still waiting in the queue is newer than what the server has, unless the server says otherwise.
    handlers?.applyRemote(rows, (row) => {
      const waiting = outbox[row.id];
      return !waiting || new Date(row.changed_at) > new Date(waiting.changed_at);
    });
    for (const row of rows) {
      if (row.synced_at > cursor) cursor = row.synced_at;
    }
    localStorage.setItem(CURSOR_KEY, cursor);
    if (rows.length < PAGE_SIZE) return;
    offset += PAGE_SIZE;
  }
}

/** Uploads the queue, then fetches what other devices changed. */
export async function syncNow() {
  if (!client) return;
  if (running) {
    runAgain = true;
    return;
  }
  running = true;
  clearTimeout(uploadTimer);
  try {
    await upload(client);
    await download(client);
    setStatus(pendingChanges() ? "saving" : "saved");
  } catch {
    setStatus("offline");
    uploadTimer = setTimeout(syncNow, RETRY_SECONDS * 1000);
  } finally {
    running = false;
    if (runAgain || (status === "saving" && pendingChanges())) {
      runAgain = false;
      uploadTimer = setTimeout(syncNow, UPLOAD_DELAY_MS);
    }
  }
}

function onWake() {
  if (document.visibilityState === "visible") void syncNow();
}

export function startSync(syncHandlers: SyncHandlers) {
  handlers = syncHandlers;
  if (!supabaseUrl || !supabaseKey) return;
  client ??= createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  outbox = readJson(OUTBOX_KEY, {});
  seedFromDevice();
  window.addEventListener("online", onWake);
  document.addEventListener("visibilitychange", onWake);
  refreshTimer = setInterval(onWake, REFRESH_SECONDS * 1000);
  void syncNow();
}

export function stopSync() {
  window.removeEventListener("online", onWake);
  document.removeEventListener("visibilitychange", onWake);
  clearInterval(refreshTimer);
  clearTimeout(uploadTimer);
}
