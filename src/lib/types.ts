export type ModuleType = "notes" | "reminders";
export type Repeat = "none" | "daily" | "weekly" | "monthly";
export type ThemeName = "clean" | "pastel" | "black" | "paper" | "custom";

export type Module = {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: ModuleType;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Note = {
  id: string;
  moduleId: string;
  title: string;
  body: string;
  items: ChecklistItem[];
  pinned: boolean;
  updatedAt: string;
};

export type Reminder = {
  id: string;
  moduleId: string;
  title: string;
  /** The next time this reminder goes off. */
  at: string;
  repeat: Repeat;
  /** When a one-time reminder went off. It stays in the list as sent. */
  firedAt?: string;
  /** When a repeating reminder last went off. */
  lastFiredAt?: string;
};

export type Task = {
  id: string;
  title: string;
  /** Local date, as YYYY-MM-DD. */
  day: string;
  done: boolean;
  first: boolean;
  moved: boolean;
  createdAt: string;
};

export type AppState = {
  modules: Module[];
  notes: Note[];
  reminders: Reminder[];
  tasks: Task[];
  theme: ThemeName;
  brand: string;
  installDismissed: boolean;
};

export type Toast = {
  id: string;
  title: string;
  detail: string;
  kind: "reminder" | "info";
};
