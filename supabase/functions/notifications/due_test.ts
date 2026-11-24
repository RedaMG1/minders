import { assertEquals } from "jsr:@std/assert@1";
import {
  digestDue,
  digestMessage,
  latestOccurrence,
  localClock,
  openTasksFor,
  type ReminderData,
  reminderTimesDue,
  type Subscription,
  type TaskData,
} from "./due.ts";

const sub = (extra: Partial<Subscription> = {}): Subscription => ({
  endpoint: "https://push.example/1",
  user_id: "u1",
  subscription: { endpoint: "https://push.example/1", keys: { auth: "a", p256dh: "b" } },
  timezone: "Europe/Paris",
  digest_time: "08:00",
  digest_enabled: true,
  reminders_enabled: true,
  last_digest_date: null,
  ...extra,
});
const task = (id: string, day: string, done = false, extra: Partial<TaskData> = {}): TaskData => ({
  id, title: id, day, done, createdAt: `2026-11-0${id.length}T08:00:00Z`, ...extra,
});
const reminder = (extra: Partial<ReminderData>): ReminderData => ({
  id: "r1", moduleId: "m1", title: "Pay rent", at: "2026-11-13T09:00:00Z", repeat: "none", ...extra,
});

Deno.test("local clock follows the time zone, including summer time", () => {
  assertEquals(localClock(new Date("2026-11-13T07:00:00Z"), "Europe/Paris"), { date: "2026-11-13", time: "08:00" });
  assertEquals(localClock(new Date("2026-07-13T06:00:00Z"), "Europe/Paris"), { date: "2026-07-13", time: "08:00" });
  assertEquals(localClock(new Date("2026-11-13T23:30:00Z"), "Europe/Paris").date, "2026-11-14");
});

Deno.test("morning summary goes out at the chosen local time, once a day", () => {
  assertEquals(digestDue(sub(), new Date("2026-11-13T06:59:00Z")), null);
  assertEquals(digestDue(sub(), new Date("2026-11-13T07:00:00Z")), "2026-11-13");
  assertEquals(digestDue(sub(), new Date("2026-11-13T07:29:00Z")), "2026-11-13");
  assertEquals(digestDue(sub(), new Date("2026-11-13T07:31:00Z")), null);
  assertEquals(digestDue(sub({ last_digest_date: "2026-11-13" }), new Date("2026-11-13T07:05:00Z")), null);
  assertEquals(digestDue(sub({ digest_enabled: false }), new Date("2026-11-13T07:05:00Z")), null);
  assertEquals(digestDue(sub({ digest_time: "21:30" }), new Date("2026-11-13T20:30:00Z")), "2026-11-13");
});

Deno.test("summary lists open tasks for today and carried over ones", () => {
  const tasks = [
    task("today", "2026-11-13"),
    task("old", "2026-11-10"),
    task("done", "2026-11-13", true),
    task("tomorrow", "2026-11-14"),
    task("firstOne", "2026-11-13", false, { first: true }),
  ];
  const open = openTasksFor(tasks, "2026-11-13");
  assertEquals(open.map((t) => t.id), ["firstOne", "old", "today"]);
  assertEquals(digestMessage(open), { title: "Today: 3 tasks", body: "firstOne, old, today", url: "/today", tag: "minders-digest" });
  assertEquals(digestMessage([...open, task("x", "2026-11-13"), task("yy", "2026-11-13")]).body, "firstOne, old, today and 2 more");
  assertEquals(digestMessage([open[0]]).title, "Today: 1 task");
});

Deno.test("tasks on hold are left out of the morning summary", () => {
  const tasks = [task("paused", "2026-11-12", false, { onHold: true }), task("open", "2026-11-13")];
  assertEquals(openTasksFor(tasks, "2026-11-13").map((t) => t.id), ["open"]);
});

Deno.test("a one-time reminder is due at its time and for the catch-up window only", () => {
  const r = reminder({});
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T08:59:59Z")), []);
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T09:00:00Z")), ["2026-11-13T09:00:00.000Z"]);
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T09:14:00Z")), ["2026-11-13T09:00:00.000Z"]);
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T09:16:00Z")), []);
});

Deno.test("a repeating reminder is due every day even if the app was never opened", () => {
  const r = reminder({ at: "2026-11-01T09:00:00Z", repeat: "daily" });
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T09:01:00Z")), ["2026-11-13T09:00:00.000Z"]);
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T12:00:00Z")), []);
});

Deno.test("a reminder the open app already moved forward is still sent for the time it just passed", () => {
  const r = reminder({ at: "2026-11-14T09:00:00Z", repeat: "daily", lastFiredAt: "2026-11-13T09:00:00Z" });
  assertEquals(reminderTimesDue(r, new Date("2026-11-13T09:00:30Z")), ["2026-11-13T09:00:00.000Z"]);
  const once = reminder({ firedAt: "2026-11-13T09:00:00Z" });
  assertEquals(reminderTimesDue(once, new Date("2026-11-13T09:00:30Z")), ["2026-11-13T09:00:00.000Z"]);
});

Deno.test("weekly and monthly repeats land on the right day", () => {
  assertEquals(latestOccurrence(new Date("2026-10-30T09:00:00Z"), "weekly", new Date("2026-11-13T10:00:00Z"))?.toISOString(), "2026-11-13T09:00:00.000Z");
  assertEquals(latestOccurrence(new Date("2026-01-31T09:00:00Z"), "monthly", new Date("2026-02-28T10:00:00Z"))?.toISOString(), "2026-02-28T09:00:00.000Z");
  assertEquals(latestOccurrence(new Date("2026-12-01T09:00:00Z"), "daily", new Date("2026-11-13T10:00:00Z")), null);
});
