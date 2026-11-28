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
  /** Shared modules are visible to every account, and anyone signed in can change their notes. */
  shared?: boolean;
  /** The account that shared it. Only that account can stop sharing or delete the module. */
  ownerId?: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

/**
 * A photo in a note. It is its own record, never shared, so other accounts never see it, and their
 * edits to a shared note can't drop it. The file lives in the account's own storage folder.
 */
export type NotePhoto = {
  id: string;
  noteId: string;
  /** Where the file is stored: <account id>/<note id>/<photo id>.jpg */
  path: string;
  /** The account that added it. Only that account sees it, even in a shared module. */
  ownerId: string;
  width: number;
  height: number;
  addedAt: string;
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
  /** Set when the task is a whole module, so its notes and reminders can be checked from the task. */
  moduleId?: string;
  /** Highlighted as a must do, and kept at the top of its day. */
  mustDo?: boolean;
  /** Paused: kept on its day but not counted as to do. Never true together with done. */
  onHold?: boolean;
  /** A time on the task's day, as HH:MM, when the phone gets a notification. Moves with the task. */
  remindTime?: string;
};

export type BudgetCategory = {
  id: string;
  name: string;
  color: string;
  /** The most you plan to spend in this category each month, in cents. */
  monthlyLimit?: number;
  /** Money put here is savings, not spending. Set on top-level categories; their subcategories follow. */
  savings?: boolean;
  /** Set on a subcategory: the category it sits in. Subcategories don't have their own subcategories. */
  parentId?: string;
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

export type NotificationSettings = {
  enabled: boolean;
  digestEnabled: boolean;
  /** Local time for the morning summary, as HH:MM. */
  digestTime: string;
  remindersEnabled: boolean;
};

export type AppState = {
  modules: Module[];
  notes: Note[];
  reminders: Reminder[];
  tasks: Task[];
  budgetCategories: BudgetCategory[];
  budgetItems: BudgetItem[];
  /** This account's note photos. */
  photos: NotePhoto[];
  theme: ThemeName;
  brand: string;
  installDismissed: boolean;
  /** This device's notification settings. Not synced: each phone or computer chooses its own. */
  notifications?: NotificationSettings;
  /** When a backup was last downloaded on this device. */
  lastBackupAt?: string;
};

export type Toast = {
  id: string;
  title: string;
  detail: string;
  kind: "reminder" | "info";
};
