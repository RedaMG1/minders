import { useSyncExternalStore } from "react";
import { addDays, dayKey, nextOccurrence, whenLabel } from "./dates";
import { DEFAULT_BRAND, DEFAULT_THEME } from "./options";
import { COLLECTIONS, getSyncStatus, startSync, stopSync, trackChanges, type ItemRow } from "./sync";
import type { AppState, BudgetCategory, BudgetItem, Module, Note, Reminder, Task, ThemeName, Toast } from "./types";

// Screens read and change the copy saved on this device, so they work with no internet.
// sync.ts keeps that copy in step with the database.
const DATA_KEY = "minders-data";
const COLOR_KEY = "minders-color";
const THEME_KEY = "minders-theme";
const TOAST_SECONDS = 3;
const CLOCK_SECONDS = 15;

const EMPTY: AppState = {
  modules: [],
  notes: [],
  reminders: [],
  tasks: [],
  budgetCategories: [],
  budgetItems: [],
  theme: DEFAULT_THEME,
  brand: DEFAULT_BRAND,
  installDismissed: false,
};

let state: AppState | null = null;
let now: Date | null = null;
let toasts: Toast[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
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
  fireDueReminders(current);
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

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", tick);
    timer = setInterval(tick, CLOCK_SECONDS * 1000);
    // Sync loads its saved queue first, because a reminder going off in tick() adds to that queue.
    startSync({ getState, applyRemote, onStatusChange: notify });
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", tick);
      clearInterval(timer);
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
  return useSyncExternalStore(subscribe, () => toasts, () => noToasts);
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
  const blank = !note.title.trim() && !note.body.trim() && !note.items.some((item) => item.text.trim());
  const saved = { ...note, updatedAt: new Date().toISOString() };
  commit((data) => {
    const others = data.notes.filter((item) => item.id !== note.id);
    return { ...data, notes: blank && !note.items.length ? others : [...others, saved] };
  });
}

export function deleteNote(id: string) {
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

export function addTask(title: string, day: string) {
  const task: Task = {
    id: newId(),
    title,
    day,
    done: false,
    first: false,
    moved: false,
    createdAt: new Date().toISOString(),
  };
  commit((data) => ({ ...data, tasks: [...data.tasks, task] }));
}

export function toggleTask(id: string) {
  changeTask(id, (task) =>
    task.done ? { ...task, done: false, doneAt: undefined } : { ...task, done: true, doneAt: new Date().toISOString() },
  );
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

export function deleteBudgetCategory(id: string) {
  commit((data) => ({
    ...data,
    budgetCategories: data.budgetCategories.filter((category) => category.id !== id),
    budgetItems: data.budgetItems.filter((item) => item.categoryId !== id),
  }));
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
export function budgetItemsInMonth(items: BudgetItem[], month: string, categoryId?: string) {
  return items
    .filter((item) => item.date.startsWith(month) && (!categoryId || item.categoryId === categoryId))
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

export function markBackedUp(at: string) {
  commit((data) => ({ ...data, lastBackupAt: at }));
}

export function dismissInstallTip() {
  commit((data) => ({ ...data, installDismissed: true }));
}

/* Things worked out from the saved data */

const byCreated = (a: Task, b: Task) => Number(b.first) - Number(a.first) || a.createdAt.localeCompare(b.createdAt);

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
