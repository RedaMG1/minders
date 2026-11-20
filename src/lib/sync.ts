import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppState, BudgetCategory, BudgetItem, Module, Note, Reminder, Task } from "./types";

// The device keeps working on its own copy. Each edit goes into a queue saved on the
// device, and the queue uploads whenever there is internet, so nothing is lost offline.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Tracked per project and per account, so a new database or a new account gets this device's data.
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
const cursorKey = (account: string) => `minders-sync-cursor:${projectRef}:${account}`;
const seededKey = (account: string) => `minders-sync-seeded:${projectRef}:${account}`;
const OUTBOX_KEY = "minders-outbox";
const DEVICE_KEY = "minders-device";
const TABLE = "items";
const UPLOAD_DELAY_MS = 1000;
const REFRESH_SECONDS = 30;
const RETRY_SECONDS = 15;
const PAGE_SIZE = 1000;
/** Fetches a little further back than needed, so a slow upload from another device is never skipped. */
const CURSOR_OVERLAP_MS = 60 * 1000;

export type Kind = "module" | "note" | "reminder" | "task" | "budget_category" | "budget_item";
export type SyncedRecord = Module | Note | Reminder | Task | BudgetCategory | BudgetItem;

export type ItemRow = {
  id: string;
  kind: Kind;
  data: SyncedRecord;
  deleted: boolean;
  changed_at: string;
  device: string;
  /** Visible to every account. Set on shared modules and on the notes and reminders inside them. */
  shared: boolean;
};

export type SyncStatus = "off" | "saving" | "saved" | "offline";

export const COLLECTIONS = [
  ["module", "modules"],
  ["note", "notes"],
  ["reminder", "reminders"],
  ["task", "tasks"],
  ["budget_category", "budgetCategories"],
  ["budget_item", "budgetItems"],
] as const;

type SyncHandlers = {
  getState: () => AppState;
  applyRemote: (rows: ItemRow[], isNewer: (row: ItemRow) => boolean) => void;
  /** Removes shared modules from other accounts that are no longer shared. */
  pruneShared: (stillShared: Set<string>) => void;
  onStatusChange: () => void;
};

let client: SupabaseClient | null = null;
/** The signed-in account. Nothing syncs without one. */
let userId: string | null = null;
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

/** Whether an item is shared: a shared module itself, or a note or reminder inside one. */
function isShared(kind: Kind, record: SyncedRecord, sharedModules: Set<string>) {
  if (kind === "module") return Boolean((record as Module).shared);
  if (kind === "note" || kind === "reminder") return sharedModules.has((record as Note | Reminder).moduleId);
  return false;
}

const sharedModulesOf = (state: AppState) => new Set(state.modules.filter((module) => module.shared).map((module) => module.id));

function enqueue(kind: Kind, record: SyncedRecord, deleted: boolean, changedAt: string, sharedModules: Set<string>) {
  outbox[record.id] = { id: record.id, kind, data: record, deleted, changed_at: changedAt, device: deviceId(), shared: isShared(kind, record, sharedModules) };
}

/** Queues everything that differs between two versions of the saved data. */
export function trackChanges(previous: AppState, next: AppState) {
  if (status === "off") return;
  const changedAt = new Date().toISOString();
  const sharedModules = sharedModulesOf(next);
  let changed = false;

  for (const [kind, key] of COLLECTIONS) {
    if (previous[key] === next[key]) continue;
    const before = new Map<string, SyncedRecord>(previous[key].map((record) => [record.id, record]));
    const after = new Set<string>();
    for (const record of next[key]) {
      after.add(record.id);
      const old = before.get(record.id);
      if (old === record || (old && JSON.stringify(old) === JSON.stringify(record))) continue;
      enqueue(kind, record, false, changedAt, sharedModules);
      changed = true;
    }
    for (const [id, record] of before) {
      if (after.has(id)) continue;
      enqueue(kind, record, true, changedAt, sharedModules);
      changed = true;
    }
  }

  // Sharing or unsharing a module also shares or unshares everything already inside it.
  const wasShared = sharedModulesOf(previous);
  const flipped = next.modules.filter((module) => wasShared.has(module.id) !== sharedModules.has(module.id)).map((module) => module.id);
  for (const [kind, key] of [["note", "notes"], ["reminder", "reminders"]] as const) {
    for (const record of next[key]) {
      if (!flipped.includes(record.moduleId)) continue;
      enqueue(kind, record, false, changedAt, sharedModules);
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
function seedFromDevice(account: string) {
  if (localStorage.getItem(seededKey(account)) || !handlers) return;
  const data = handlers.getState();
  const sharedModules = sharedModulesOf(data);
  for (const [kind, key] of COLLECTIONS) {
    for (const record of data[key]) {
      if (outbox[record.id]) continue;
      const stamped = record as { updatedAt?: string; createdAt?: string };
      enqueue(kind, record, false, stamped.updatedAt ?? stamped.createdAt ?? new Date().toISOString(), sharedModules);
    }
  }
  saveOutbox();
  localStorage.setItem(seededKey(account), "1");
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

async function download(supabase: SupabaseClient, account: string) {
  let cursor = localStorage.getItem(cursorKey(account)) ?? "1970-01-01T00:00:00Z";
  const since = new Date(new Date(cursor).getTime() - CURSOR_OVERLAP_MS).toISOString();
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, kind, data, deleted, changed_at, device, shared, synced_at")
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
    localStorage.setItem(cursorKey(account), cursor);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // A module that stops being shared just becomes invisible, so ask which ones are still shared.
  const { data: shared, error } = await supabase.from(TABLE).select("id").eq("kind", "module").eq("shared", true).eq("deleted", false);
  if (error) throw error;
  handlers?.pruneShared(new Set((shared ?? []).map((row) => row.id as string)));
}

/** Uploads the queue, then fetches what other devices changed. */
export async function syncNow() {
  const account = userId;
  if (!client || !account) return;
  if (running) {
    runAgain = true;
    return;
  }
  running = true;
  clearTimeout(uploadTimer);
  try {
    await upload(client);
    // Signing out while this ran would otherwise bring the old account's data back.
    if (account !== userId) return;
    await download(client, account);
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

/** The database connection, or null when this build has no database settings. */
export function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  client ??= createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "minders-auth" },
  });
  return client;
}

/** Where the notifications server function lives, or null without database settings. */
export const notificationsUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/notifications` : null;
export const publishableKey = supabaseKey ?? "";

export function startSync(syncHandlers: SyncHandlers) {
  handlers = syncHandlers;
  if (!getSupabase()) return;
  outbox = readJson(OUTBOX_KEY, {});
  window.addEventListener("online", onWake);
  document.addEventListener("visibilitychange", onWake);
  refreshTimer = setInterval(onWake, REFRESH_SECONDS * 1000);
}

export function stopSync() {
  window.removeEventListener("online", onWake);
  document.removeEventListener("visibilitychange", onWake);
  clearInterval(refreshTimer);
  clearTimeout(uploadTimer);
}

/** Starts syncing for an account, or stops when signed out. */
export function setSyncAccount(account: string | null) {
  if (account === userId) return;
  userId = account;
  if (!account) {
    clearTimeout(uploadTimer);
    return;
  }
  seedFromDevice(account);
  setStatus("saving");
  void syncNow();
}

/** Empties the upload queue, for when this device's data is cleared on sign out. */
export function clearQueue() {
  outbox = {};
  saveOutbox();
}

/** Whether the signed-in account may download every account's data. False when unsure. */
export async function isMainAccount() {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/** Every account with all of its items, for the main account's full backup. */
export async function fetchAllAccounts() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("No database");
  const { data, error } = await supabase.rpc("export_all_accounts");
  if (error) throw error;
  return data as unknown[];
}
