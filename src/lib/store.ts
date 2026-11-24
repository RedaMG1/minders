import { useSyncExternalStore } from "react";
import { addDays, dayKey, nextOccurrence, whenLabel } from "./dates";
import { DEFAULT_BRAND, DEFAULT_THEME } from "./options";
import { onAccountChange, signOutOfAccount } from "./auth";
import { forgetPhotosOnDevice, removePhotoFiles } from "./photos";
import { clearQueue, COLLECTIONS, getSupabase, getSyncStatus, pendingChanges, setSyncAccount, startSync, stopSync, trackChanges, type ItemRow } from "./sync";
import type { AppState, BudgetCategory, BudgetItem, Module, NotePhoto, NotificationSettings, Note, Reminder, Task, ThemeName, Toast } from "./types";

// Screens read and change the copy saved on this device, so they work with no internet.
// sync.ts keeps that copy in step with the database.
const DATA_KEY = "minders-data";
const COLOR_KEY = "minders-color";
const THEME_KEY = "minders-theme";
/** The account this device's data belongs to. */
const OWNER_KEY = "minders-owner";
const TOAST_SECONDS = 3;
const CLOCK_SECONDS = 15;

const EMPTY: AppState = {
  modules: [],
  notes: [],
  reminders: [],
  tasks: [],
  budgetCategories: [],
  budgetItems: [],
  photos: [],
  theme: DEFAULT_THEME,
  brand: DEFAULT_BRAND,
  installDismissed: false,
};

let state: AppState | null = null;
let now: Date | null = null;
let toasts: Toast[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
let stopAccounts: (() => void) | undefined;
/** Whether someone is signed in. Without a database there are no accounts, so the data is always open. */
let signedIn = false;
let currentUser: string | null = null;

/** The signed-in account's id, or null. */
export const currentUserId = () => currentUser;
const dataIsOpen = () => signedIn || !getSupabase();
const listeners = new Set<() => void>();

export function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function read(): AppState {
  try {
    const saved = localStorage.getItem(DATA_KEY);
    return saved ? { ...EMPTY, ...JSON.parse(saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getState() {
  if (!state) state = read();
  return state;
}

function getNow() {
  if (!now) now = new Date();
  return now;
}

const notify = () => listeners.forEach((listener) => listener());

function save(next: AppState) {
  state = next;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(next));
    localStorage.setItem(COLOR_KEY, next.brand);
    localStorage.setItem(THEME_KEY, next.theme);
  } catch {
    pushToast({ title: "Could not save", detail: "This device's storage is full or blocked.", kind: "info" });
  }
}

function commit(change: (current: AppState) => AppState) {
  const previous = getState();
  const next = change(previous);
  save(next);
  trackChanges(previous, next);
  notify();
}

/** Brings in what other devices changed, without queueing it to upload again. */
/** Drops shared modules from other accounts that are no longer shared, without uploading anything. */
function pruneShared(stillShared: Set<string>) {
  const current = getState();
  const gone = new Set(
    current.modules
      .filter((module) => module.shared && module.ownerId && module.ownerId !== currentUser && !stillShared.has(module.id))
      .map((module) => module.id),
  );
  if (!gone.size) return;
  save({
    ...current,
    modules: current.modules.filter((module) => !gone.has(module.id)),
    notes: current.notes.filter((note) => !gone.has(note.moduleId)),
    reminders: current.reminders.filter((reminder) => !gone.has(reminder.moduleId)),
  });
  notify();
}

/** Whether this account can share, unshare or delete a module. */
export const ownsModule = (module: Module) => !module.ownerId || module.ownerId === currentUser;

export function setModuleShared(module: Module, shared: boolean) {
  saveModule({ ...module, shared, ownerId: shared ? (currentUser ?? undefined) : undefined });
}

function applyRemote(rows: ItemRow[], isNewer: (row: ItemRow) => boolean) {
  const current = getState();
  let next = current;
  for (const [kind, key] of COLLECTIONS) {
    const incoming = rows.filter((row) => row.kind === kind && isNewer(row));
    if (!incoming.length) continue;
    const records = new Map<string, unknown>(current[key].map((record) => [record.id, record]));
    let changed = false;
    for (const row of incoming) {
      if (row.deleted) {
        changed = records.delete(row.id) || changed;
      } else if (JSON.stringify(records.get(row.id)) !== JSON.stringify(row.data)) {
        records.set(row.id, row.data);
        changed = true;
      }
    }
    if (changed) next = { ...next, [key]: [...records.values()] };
  }
  if (next === current) return;
  save(next);
  notify();
}

function pushToast(toast: Omit<Toast, "id">) {
  const id = newId();
  toasts = [...toasts, { ...toast, id }];
  notify();
  if (toast.kind === "info") setTimeout(() => dismissToast(id), TOAST_SECONDS * 1000);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((toast) => toast.id !== id);
  notify();
}

export function showMessage(title: string, detail = "") {
  pushToast({ title, detail, kind: "info" });
}

/** Sends every reminder that has come due. These appear inside the open app. */
function fireDueReminders(current: Date) {
  const data = getState();
  const due = data.reminders.filter((reminder) => !reminder.firedAt && new Date(reminder.at) <= current);
  if (!due.length) return;

  commit((latest) => ({
    ...latest,
    reminders: latest.reminders.map((reminder) => {
      if (!due.some((item) => item.id === reminder.id)) return reminder;
      if (reminder.repeat === "none") return { ...reminder, firedAt: reminder.at };
      const next = nextOccurrence(new Date(reminder.at), reminder.repeat, current);
      return { ...reminder, at: next.toISOString(), lastFiredAt: reminder.at };
    }),
  }));

  due.forEach((reminder) => {
    const moduleName = data.modules.find((module) => module.id === reminder.moduleId)?.name ?? "";
    const when = whenLabel(new Date(reminder.at), current);
    pushToast({ title: reminder.title, detail: moduleName ? `${moduleName}, ${when}` : when, kind: "reminder" });
  });
}

function tick() {
  const current = new Date();
  // Reminders wait until someone signs in, so the sign-in screen never shows anyone's data.
  if (dataIsOpen()) fireDueReminders(current);
  if (!now || now.getMinutes() !== current.getMinutes() || now.getHours() !== current.getHours()) {
    now = current;
    notify();
  }
}

function onStorage(event: StorageEvent) {
  if (event.key !== DATA_KEY) return;
  state = read();
  notify();
}

/** Empties this device's copy, keeping only its look. Used when an account signs out or another signs in. */
function clearDeviceData() {
  const current = getState();
  clearQueue();
  void forgetPhotosOnDevice();
  save({ ...EMPTY, theme: current.theme, brand: current.brand, installDismissed: current.installDismissed });
  toasts = [];
  notify();
}

function switchAccount(userId: string | null) {
  if (userId) {
    // A device with no owner yet keeps its data for the first account, so nothing written before accounts is lost.
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== userId) clearDeviceData();
    localStorage.setItem(OWNER_KEY, userId);
  }
  signedIn = Boolean(userId);
  currentUser = userId;
  setSyncAccount(userId);
  if (signedIn) tick();
}

/** Changes made on this device that haven't uploaded yet. */
export const unsyncedChanges = () => pendingChanges();

/** Signs out and clears this device's copy, so the next person never sees it. */
export async function signOutAndClear() {
  await signOutOfAccount();
  clearDeviceData();
  localStorage.removeItem(OWNER_KEY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", tick);
    timer = setInterval(tick, CLOCK_SECONDS * 1000);
    // Sync loads its saved queue first, because a reminder going off in tick() adds to that queue.
    startSync({ getState, applyRemote, pruneShared, onStatusChange: notify });
    stopAccounts = onAccountChange(switchAccount);
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", tick);
      clearInterval(timer);
      stopAccounts?.();
      stopSync();
    }
  };
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribe, getSyncStatus, () => "off" as const);
}

/** The saved data and the current minute. It is null while the page is prerendered. */
export function useApp() {
  const data = useSyncExternalStore(subscribe, getState, () => null);
  const time = useSyncExternalStore(subscribe, getNow, () => null);
  return data && time ? { state: data, now: time } : null;
}

const noToasts: Toast[] = [];
export function useToasts() {
  return useSyncExternalStore(subscribe, () => (dataIsOpen() ? toasts : noToasts), () => noToasts);
}

/* Modules */

export function saveModule(module: Module) {
  commit((data) => ({
    ...data,
    modules: data.modules.some((item) => item.id === module.id)
      ? data.modules.map((item) => (item.id === module.id ? module : item))
      : [...data.modules, module],
  }));
}

export function deleteModule(id: string) {
  const notes = new Set(getState().notes.filter((note) => note.moduleId === id).map((note) => note.id));
  dropPhotos((photo) => notes.has(photo.noteId));
  commit((data) => ({
    ...data,
    modules: data.modules.filter((module) => module.id !== id),
    notes: data.notes.filter((note) => note.moduleId !== id),
    reminders: data.reminders.filter((reminder) => reminder.moduleId !== id),
  }));
}

/* Notes */

/** Saves a note, or removes it once it has nothing in it, so blank notes never pile up. */
export function saveNote(note: Note) {
  const empty = !note.title.trim() && !note.body.trim() && !note.items.length;
  const saved = { ...note, updatedAt: new Date().toISOString() };
  commit((data) => {
    const others = data.notes.filter((item) => item.id !== note.id);
    const hasPhotos = data.photos.some((photo) => photo.noteId === note.id);
    return { ...data, notes: empty && !hasPhotos ? others : [...others, saved] };
  });
}

/**
 * Adds an uploaded photo to its note. A draft note (never saved) is saved along with it. If the note was
 * saved but has been deleted since the upload started, the photo is dropped and its file deleted.
 */
export function addNotePhoto(draft: Note, wasSaved: boolean, photo: NotePhoto) {
  const exists = getState().notes.some((note) => note.id === photo.noteId);
  if (!exists && wasSaved) {
    void removePhotoFiles([photo.path]);
    return;
  }
  commit((data) => ({
    ...data,
    notes: exists ? data.notes : [...data.notes, { ...draft, updatedAt: new Date().toISOString() }],
    photos: [...data.photos, photo],
  }));
}

/** Takes a photo off its note and deletes its file. */
export function removeNotePhoto(photo: NotePhoto) {
  dropPhotos((item) => item.id === photo.id);
}

/** Removes photo records and deletes their files. */
function dropPhotos(match: (photo: NotePhoto) => boolean) {
  const gone = getState().photos.filter(match);
  if (!gone.length) return;
  const ids = new Set(gone.map((photo) => photo.id));
  commit((data) => ({ ...data, photos: data.photos.filter((photo) => !ids.has(photo.id)) }));
  void removePhotoFiles(gone.map((photo) => photo.path));
}

export function deleteNote(id: string) {
  dropPhotos((photo) => photo.noteId === id);
  commit((data) => ({ ...data, notes: data.notes.filter((note) => note.id !== id) }));
}

/* Reminders */

export function saveReminder(reminder: Reminder) {
  commit((data) => ({
    ...data,
    reminders: [...data.reminders.filter((item) => item.id !== reminder.id), reminder],
  }));
  tick();
}

export function deleteReminder(id: string) {
  commit((data) => ({ ...data, reminders: data.reminders.filter((reminder) => reminder.id !== id) }));
}

/* Tasks */

const changeTask = (id: string, change: (task: Task) => Task) =>
  commit((data) => ({ ...data, tasks: data.tasks.map((task) => (task.id === id ? change(task) : task)) }));

export function addTask(title: string, day: string, moduleId?: string) {
  const task: Task = {
    id: newId(),
    title,
    day,
    done: false,
    first: false,
    moved: false,
    createdAt: new Date().toISOString(),
    ...(moduleId ? { moduleId } : {}),
  };
  commit((data) => ({ ...data, tasks: [...data.tasks, task] }));
}

/** Ticks a checklist item in a note on or off, such as from a module task. */
export function toggleNoteItem(noteId: string, itemId: string) {
  const updatedAt = new Date().toISOString();
  commit((data) => ({
    ...data,
    notes: data.notes.map((note) =>
      note.id === noteId
        ? { ...note, updatedAt, items: note.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)) }
        : note,
    ),
  }));
}

export function toggleTask(id: string) {
  changeTask(id, (task) =>
    task.done
      ? { ...task, done: false, doneAt: undefined }
      : { ...task, done: true, onHold: false, doneAt: new Date().toISOString() },
  );
}

/** Puts a task on hold, which clears must do and first thing, or puts it back to do. */
export function toggleOnHold(id: string) {
  changeTask(id, (task) => (task.onHold ? { ...task, onHold: false } : { ...task, onHold: true, mustDo: false, first: false }));
}

/** Marks a task as a must do, or clears it. */
export function toggleMustDo(id: string) {
  changeTask(id, (task) => ({ ...task, mustDo: !task.mustDo }));
}

export function moveTask(id: string, day: string, moved: boolean) {
  changeTask(id, (task) => ({ ...task, day, moved, first: false }));
}

/** Moves several tasks in one go, such as everything left unfinished today. */
export function moveTasks(ids: string[], day: string) {
  const moving = new Set(ids);
  commit((data) => ({
    ...data,
    tasks: data.tasks.map((task) => (moving.has(task.id) ? { ...task, day, moved: true, first: false } : task)),
  }));
}

export function deleteTask(id: string) {
  commit((data) => ({ ...data, tasks: data.tasks.filter((task) => task.id !== id) }));
}

/** Makes one task the first thing of its day, or clears it if it already is. */
export function setFirstTask(id: string) {
  commit((data) => {
    const target = data.tasks.find((task) => task.id === id);
    if (!target) return data;
    return {
      ...data,
      tasks: data.tasks.map((task) =>
        task.day === target.day ? { ...task, first: task.id === id && !task.first } : task,
      ),
    };
  });
}

/* Budget */

export function saveBudgetCategory(category: BudgetCategory) {
  commit((data) => ({
    ...data,
    budgetCategories: data.budgetCategories.some((item) => item.id === category.id)
      ? data.budgetCategories.map((item) => (item.id === category.id ? category : item))
      : [...data.budgetCategories, category],
  }));
}

/** A category's id plus the ids of its subcategories, so totals and deletes cover them all. */
export function categoryFamily(categories: BudgetCategory[], id: string) {
  return [id, ...categories.filter((category) => category.parentId === id).map((category) => category.id)];
}

/** Deletes a category with its subcategories and every item in them. */
export function deleteBudgetCategory(id: string) {
  commit((data) => {
    const family = new Set(categoryFamily(data.budgetCategories, id));
    return {
      ...data,
      budgetCategories: data.budgetCategories.filter((category) => !family.has(category.id)),
      budgetItems: data.budgetItems.filter((item) => !family.has(item.categoryId)),
    };
  });
}

export function saveBudgetItem(item: BudgetItem) {
  commit((data) => ({
    ...data,
    budgetItems: [...data.budgetItems.filter((other) => other.id !== item.id), item],
  }));
}

export function deleteBudgetItem(id: string) {
  commit((data) => ({ ...data, budgetItems: data.budgetItems.filter((item) => item.id !== id) }));
}

/** A month's items, newest date first. */
export function budgetItemsInMonth(items: BudgetItem[], month: string, categoryIds?: string[]) {
  return items
    .filter((item) => item.date.startsWith(month) && (!categoryIds || categoryIds.includes(item.categoryId)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export const sumAmounts = (items: BudgetItem[]) => items.reduce((total, item) => total + item.amount, 0);

/* Settings */

export function setTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  commit((data) => ({ ...data, theme }));
}

export function setBrand(brand: string) {
  document.documentElement.style.setProperty("--brand", brand);
  commit((data) => ({ ...data, brand }));
}

export function setNotificationSettings(notifications: NotificationSettings) {
  commit((data) => ({ ...data, notifications }));
}

export function markBackedUp(at: string) {
  commit((data) => ({ ...data, lastBackupAt: at }));
}

export function dismissInstallTip() {
  commit((data) => ({ ...data, installDismissed: true }));
}

/* Things worked out from the saved data */

const byCreated = (a: Task, b: Task) =>
  Number(b.first) - Number(a.first) || Number(Boolean(b.mustDo)) - Number(Boolean(a.mustDo)) || a.createdAt.localeCompare(b.createdAt);

/** Today's tasks, plus anything from earlier days that is unfinished or was finished today. */
export function tasksForToday(tasks: Task[], current: Date) {
  const today = dayKey(current);
  return tasks
    .filter((task) => task.day === today || (task.day < today && (!task.done || doneDay(task) === today)))
    .sort(byCreated);
}

export function tasksForTomorrow(tasks: Task[], current: Date) {
  const tomorrow = dayKey(addDays(current, 1));
  return tasks.filter((task) => task.day === tomorrow).sort(byCreated);
}

/** The day a task was finished on. Tasks ticked before this was recorded count on their planned day. */
export function doneDay(task: Task) {
  return task.doneAt ? dayKey(new Date(task.doneAt)) : task.day;
}

/** Every finished task, grouped by the day it was done, newest day first. */
export function doneHistory(tasks: Task[]) {
  const days = new Map<string, Task[]>();
  for (const task of tasks.filter((item) => item.done)) {
    const day = doneDay(task);
    days.set(day, [...(days.get(day) ?? []), task]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({
      day,
      tasks: items.sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")),
    }));
}

export function upcomingReminders(reminders: Reminder[]) {
  return reminders.filter((reminder) => !reminder.firedAt).sort((a, b) => a.at.localeCompare(b.at));
}

export type ReminderRow = { reminder: Reminder; at: Date; sent: boolean };

/** Everything on today's clock: reminders already sent today and those still to come. */
export function todaysReminderRows(reminders: Reminder[], current: Date): ReminderRow[] {
  const today = dayKey(current);
  const rows: ReminderRow[] = [];
  for (const reminder of reminders) {
    const sentAt = reminder.firedAt ?? reminder.lastFiredAt;
    if (sentAt && dayKey(new Date(sentAt)) === today) rows.push({ reminder, at: new Date(sentAt), sent: true });
    if (!reminder.firedAt && dayKey(new Date(reminder.at)) === today) {
      rows.push({ reminder, at: new Date(reminder.at), sent: false });
    }
  }
  return rows.sort((a, b) => a.at.getTime() - b.at.getTime());
}
