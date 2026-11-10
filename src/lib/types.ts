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
  /** Checklist items the Randomiser picked, kept until cleared. */
  picked?: string[];
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
  /** When the task was ticked off. Older tasks may not have it. */
  doneAt?: string;
  first: boolean;
  moved: boolean;
  createdAt: string;
};

export type BudgetCategory = {
  id: string;
  name: string;
  color: string;
  /** The most you plan to spend in this category each month, in cents. */
  monthlyLimit?: number;
  createdAt: string;
};

export type BudgetItem = {
  id: string;
  categoryId: string;
  label: string;
  /** Stored in cents, so adding up never gives rounding errors. */
  amount: number;
  /** Local date, as YYYY-MM-DD. */
  date: string;
  createdAt: string;
};

export type AppState = {
  modules: Module[];
  notes: Note[];
  reminders: Reminder[];
  tasks: Task[];
  budgetCategories: BudgetCategory[];
  budgetItems: BudgetItem[];
  theme: ThemeName;
  brand: string;
  installDismissed: boolean;
  /** When a backup was last downloaded on this device. */
  lastBackupAt?: string;
};

export type Toast = {
  id: string;
  title: string;
  detail: string;
  kind: "reminder" | "info";
};
