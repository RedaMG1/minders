// Works out which notifications are due. Kept free of network and database code so it can be tested on its own.

export type Repeat = "none" | "daily" | "weekly" | "monthly";

export type TaskData = {
  id: string;
  title: string;
  day: string;
  done: boolean;
  first?: boolean;
  onHold?: boolean;
  createdAt: string;
};

export type ReminderData = {
  id: string;
  moduleId: string;
  title: string;
  at: string;
  repeat: Repeat;
  firedAt?: string;
  lastFiredAt?: string;
};

export type Subscription = {
  endpoint: string;
  user_id: string;
  subscription: { endpoint: string; keys: { auth: string; p256dh: string } };
  timezone: string;
  digest_time: string;
  digest_enabled: boolean;
  reminders_enabled: boolean;
  last_digest_date: string | null;
};

export type Message = { title: string; body: string; url: string; tag: string };

/** Notifications that were missed because the server was briefly down still go out within this time. */
export const CATCH_UP_MINUTES = 15;
/** The morning summary is skipped if it would arrive more than this long after the chosen time. */
export const DIGEST_LATE_MINUTES = 30;
const SHOWN_TASKS = 3;
const MAX_STEPS = 5000;

const pad = (n: number) => String(n).padStart(2, "0");

/** The date and time on the person's clock, as YYYY-MM-DD and HH:MM. */
export function localClock(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/** The local date to send the morning summary for, or null if it isn't time. */
export function digestDue(sub: Subscription, now: Date) {
  if (!sub.digest_enabled) return null;
  const { date, time } = localClock(now, sub.timezone);
  const late = minutesOf(time) - minutesOf(sub.digest_time);
  if (late < 0 || late > DIGEST_LATE_MINUTES || sub.last_digest_date === date) return null;
  return date;
}

/** What is still to do on a local date: that day's open tasks, plus open tasks from earlier days. */
export function openTasksFor(tasks: TaskData[], date: string) {
  return tasks
    .filter((task) => !task.done && !task.onHold && task.day <= date)
    .sort((a, b) => Number(Boolean(b.first)) - Number(Boolean(a.first)) || a.createdAt.localeCompare(b.createdAt));
}

export function digestMessage(tasks: TaskData[]): Message {
  const shown = tasks.slice(0, SHOWN_TASKS).map((task) => task.title);
  const rest = tasks.length - shown.length;
  return {
    title: `Today: ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
    body: rest > 0 ? `${shown.join(", ")} and ${rest} more` : shown.join(", "),
    url: "/today",
    tag: "minders-digest",
  };
}

function step(date: Date, repeat: Repeat, count: number) {
  const next = new Date(date);
  if (repeat === "daily") next.setUTCDate(next.getUTCDate() + count);
  else if (repeat === "weekly") next.setUTCDate(next.getUTCDate() + count * 7);
  else {
    // Keeps the 31st on the last day of a shorter month, like the app does.
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + count);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  return next;
}

/** The most recent time a reminder went off at or before now, following its repeat. */
export function latestOccurrence(at: Date, repeat: Repeat, now: Date) {
  if (at > now) return null;
  if (repeat === "none") return at;
  let latest = at;
  for (let count = 1; count < MAX_STEPS; count++) {
    const next = step(at, repeat, count);
    if (next > now) break;
    latest = next;
  }
  return latest;
}

/**
 * The times a reminder should have gone off in the last few minutes. The app moves a repeating
 * reminder forward when it goes off while open, so its previous time is checked too.
 */
export function reminderTimesDue(reminder: ReminderData, now: Date) {
  const earliest = now.getTime() - CATCH_UP_MINUTES * 60 * 1000;
  const candidates = [reminder.at, reminder.firedAt, reminder.lastFiredAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value));
  const latest = latestOccurrence(new Date(reminder.at), reminder.repeat, now);
  if (latest) candidates.push(latest);
  const due = candidates.filter((time) => !Number.isNaN(time.getTime()) && time.getTime() <= now.getTime() && time.getTime() > earliest);
  return [...new Set(due.map((time) => time.toISOString()))];
}

export function reminderMessage(reminder: ReminderData, moduleName: string | undefined): Message {
  return { title: reminder.title, body: moduleName ? `Reminder from ${moduleName}` : "Reminder", url: "/reminders", tag: `minders-reminder-${reminder.id}` };
}

export function testMessage(): Message {
  return { title: "Notifications are on", body: "This is how Minders will reach you.", url: "/notifications", tag: "minders-test" };
}

export { pad };
