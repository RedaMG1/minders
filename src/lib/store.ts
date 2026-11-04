import { useSyncExternalStore } from "react";
import { addDays, dayKey, nextOccurrence, whenLabel } from "./dates";
import { DEFAULT_BRAND, DEFAULT_THEME } from "./options";
import type { AppState, Module, Note, Reminder, Task, ThemeName, Toast } from "./types";

// Everything is saved on this device for now. This file is the only place that
// knows that, so syncing through a database later only needs changes here.
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

function commit(change: (current: AppState) => AppState) {
  state = change(getState());
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
    localStorage.setItem(COLOR_KEY, state.brand);
    localStorage.setItem(THEME_KEY, state.theme);
  } catch {
    pushToast({ title: "Could not save", detail: "This device's storage is full or blocked.", kind: "info" });
  }
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
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", tick);
      clearInterval(timer);
    }
  };
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
  changeTask(id, (task) => ({ ...task, done: !task.done }));
}

export function moveTask(id: string, day: string, moved: boolean) {
  changeTask(id, (task) => ({ ...task, day, moved, first: false }));
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

/* Settings */

export function setTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  commit((data) => ({ ...data, theme }));
}

export function setBrand(brand: string) {
  document.documentElement.style.setProperty("--brand", brand);
  commit((data) => ({ ...data, brand }));
}

export function dismissInstallTip() {
  commit((data) => ({ ...data, installDismissed: true }));
}

/* Things worked out from the saved data */

const byCreated = (a: Task, b: Task) => Number(b.first) - Number(a.first) || a.createdAt.localeCompare(b.createdAt);

/** Today's tasks, plus anything unfinished from earlier days. */
export function tasksForToday(tasks: Task[], current: Date) {
  const today = dayKey(current);
  return tasks.filter((task) => task.day === today || (task.day < today && !task.done)).sort(byCreated);
}

export function tasksForTomorrow(tasks: Task[], current: Date) {
  const tomorrow = dayKey(addDays(current, 1));
  return tasks.filter((task) => task.day === tomorrow).sort(byCreated);
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
