import type { Repeat } from "./types";

const LOCALE = "en-GB";
const pad = (n: number) => String(n).padStart(2, "0");

/** A local date as YYYY-MM-DD, which also sorts correctly as text. */
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Adds months, keeping the 31st on the last day of a shorter month. */
export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

export function atTime(date: Date, hours: number, minutes = 0) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const weekdayLong = (date: Date) => date.toLocaleDateString(LOCALE, { weekday: "long" });
export const dayMonthLong = (date: Date) => `${date.getDate()} ${date.toLocaleDateString(LOCALE, { month: "long" })}`;
export const dayMonth = (date: Date) => `${date.getDate()} ${date.toLocaleDateString(LOCALE, { month: "short" })}`;

/** For example "Thu 5 Nov". */
export function shortDate(date: Date) {
  return `${date.toLocaleDateString(LOCALE, { weekday: "short" })} ${dayMonth(date)}`;
}

/** For example "Sat 7". */
export function weekdayDay(date: Date) {
  return `${date.toLocaleDateString(LOCALE, { weekday: "short" })} ${date.getDate()}`;
}

/** For example "Today, 14:30", "Tomorrow, 08:00" or "Mon 9 Nov, 08:00". */
export function whenLabel(date: Date, now: Date) {
  const key = dayKey(date);
  if (key === dayKey(now)) return `Today, ${clock(date)}`;
  if (key === dayKey(addDays(now, 1))) return `Tomorrow, ${clock(date)}`;
  return `${shortDate(date)}, ${clock(date)}`;
}

/** For example "Today", "Yesterday" or "28 Oct". */
export function relativeDay(date: Date, now: Date) {
  const key = dayKey(date);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(addDays(now, -1))) return "Yesterday";
  return dayMonth(date);
}

/** For example "in 2 h 50 min". */
export function timeUntil(date: Date, now: Date) {
  const minutes = Math.max(0, Math.round((date.getTime() - now.getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `in ${hours} h ${rest} min` : `in ${hours} h`;
}

/** The value format used by datetime-local inputs. */
export function toInputValue(date: Date) {
  return `${dayKey(date)}T${clock(date)}`;
}

export function repeatLabel(repeat: Repeat, at: Date) {
  if (repeat === "daily") return "every day";
  if (repeat === "weekly") return `every ${weekdayLong(at)}`;
  if (repeat === "monthly") return "every month";
  return "";
}

/** The first time after `now` that a repeating reminder should go off. */
export function nextOccurrence(at: Date, repeat: Repeat, now: Date) {
  let count = 1;
  let next = at;
  while (next.getTime() <= now.getTime()) {
    if (repeat === "daily") next = addDays(at, count);
    else if (repeat === "weekly") next = addDays(at, count * 7);
    else next = addMonths(at, count);
    count += 1;
  }
  return next;
}
