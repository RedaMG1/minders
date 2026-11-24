# Phone Notifications and Task Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notifications reach the phone when Minders is closed. A task on Today or Tomorrow can have a time that sends a notification.

**Architecture:** The app stores an optional `remindTime` ("HH:MM") on a task. It syncs like the rest of the task. The existing Edge Function `notifications` gets a third kind of notification: on each minute's tick it sends due task times to each of the account's devices, using that device's time zone. Each one is claimed in `push_sent` so it goes out once. The function and its SQL (tables, sign-up functions, every-minute job) are then deployed on the live project.

**Tech Stack:** Next.js 16 static export, React 19, TypeScript; Supabase Edge Functions (Deno 2, `jsr:@negrel/webpush@0.5.0`), pg_cron and pg_net.

**Spec:** `docs/superpowers/specs/2026-11-24-phone-notifications-design.md`

## Global Constraints

- Project `lmaxbibmdytwfujfcqcz`. Function URL `https://lmaxbibmdytwfujfcqcz.supabase.co/functions/v1/notifications`.
- Each phone only gets its own signed-in account's notifications.
- A task time is sent at that time on the phone's clock, once per device. It is not sent if the task is done or on hold by then.
- Moving a task to another day moves its time with it: the time belongs to the task's `day`.
- Tapping a task notification opens `/today`.
- Missed sends still go out within `CATCH_UP_MINUTES` (15) and never later.
- Tests:
  - Server: `cd supabase/functions/notifications && npx --yes deno@2.9.6 test --allow-env --allow-net --allow-read`.
  - App: browser checks against the pretend Supabase, kept in the session scratchpad as before.
  - Always also `npx tsc --noEmit` and `npm run lint`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A phone in a different time zone:** sends at the chosen time on that phone's clock (Task 2 test with two time zones).
2. **A task moved to tomorrow after setting its time:** sends tomorrow, not today (Task 1 browser check plus a Task 2 "other day" test).
3. **A task ticked done, or put on hold, before its time:** nothing is sent (Task 2 test).
4. **Two phones on the same account:** each gets it once, and the next tick sends nothing (Task 2 handle test).
5. **The server down for a few minutes:** sent if 15 minutes late or less, not if later (Task 2 test).

---

### Task 1: Task times in the app

**Files:**
- Modify:
  - `src/lib/types.ts` (Task)
  - `src/lib/store.ts`
  - `src/components/TaskRow.tsx`
  - `src/app/globals.css`
- Create: `src/components/TaskTimeSheet.tsx`
- Test: `<scratchpad>/tasktime-e2e.mjs`

**Interfaces:**
- Produces:
  - `Task.remindTime?: string` ("HH:MM")
  - `setTaskTime(id: string, time: string | null): void` in store.ts
- In-app firing: the store's `tick()` also fires task times. It remembers what it already showed in localStorage key `minders-task-alerts` (keys `${id}@${day}T${time}`), so each shows once per device.

- [ ] **Step 1: Write the failing browser test** with these checks:
  - On Today, `[aria-label="Set a time for Call the bank"]` opens a sheet with `#task-time`. Saving "15:00" sets `remindTime: "15:00"` locally and on the database row.
  - The row shows a tag reading "15:00".
  - The button's label becomes `Change the time for Call the bank`; the sheet's "Remove time" clears it.
  - Moving the task to tomorrow keeps `remindTime`, and the tag shows on Tomorrow.
  - With a time set to the current minute, an in-app message with the task's title appears within 20 s. After reloading, it doesn't appear a second time.
  - Done rows and on hold rows have no 🔔 button.
- [ ] **Step 2: Run it.** Expected: FAIL at the first check.
- [ ] **Step 3: Implement.**
  - Bell icon (`bell` exists).
  - The sheet uses `<input type="time" id="task-time">` and the existing `Sheet`, titled "Notify me at".
  - The 🔔 button sits before the pause button, and only on not-done, not-on-hold rows. The tag is `.tag.time-tag` with a small bell.
  - In-app firing uses `pushToast` with kind `"reminder"`, the task's title, and detail "Planned for now". It fires only when `task.day` is today's local date and the local time is between `remindTime` and 15 minutes after.
- [ ] **Step 4: Run** the browser test, tsc and lint. Expected: all PASS.
- [ ] **Step 5: Commit** "Let a task have a notification time".

### Task 2: The server sends task times

**Files:**
- Modify:
  - `supabase/functions/notifications/due.ts`
  - `supabase/functions/notifications/index.ts`
  - `supabase/functions/notifications/due_test.ts`
  - `supabase/functions/notifications/handle_test.ts`

**Interfaces:**
- Consumes: `Task.remindTime` from Task 1, as `TaskData.remindTime?: string`.
- Produces, in due.ts:
  - `taskAlertsDue(tasks: TaskData[], sub: Subscription, now: Date): TaskData[]`
  - `taskMessage(task: TaskData): Message`, which returns `{ title: task.title, body: "Planned for now", url: "/today", tag: "minders-task-" + task.id }`.

- [ ] **Step 1: Write failing Deno tests.**
  - `due_test.ts`, with sub time zone "Europe/Paris" and task `{ day: "2026-11-24", remindTime: "15:00" }`:
    - Due at 14:00Z, which is 15:00 Paris.
    - Due at 14:15Z, still within catch-up.
    - Not at 14:16Z, and not at 13:59Z.
    - Not when `done`, not when `onHold`, and not when `day` is "2026-11-25".
    - A sub in "America/New_York" isn't due at 14:00Z, but is at 20:00Z.
  - `handle_test.ts`:
    - Two subscriptions for the same account and one due task: the tick sends 2 pushes, and a second tick at the same time sends 0.
    - A subscription for another account gets nothing.
- [ ] **Step 2: Run them.** Expected: FAIL ("taskAlertsDue" not exported).
- [ ] **Step 3: Implement.**
  - `taskAlertsDue`: due when the task's `day` equals the sub's local date, and 0 ≤ local minutes − remind minutes ≤ `CATCH_UP_MINUTES`.
  - In `tick`, for each subscription with `reminders_enabled`, take its account's due tasks and claim each in `push_sent`:
    - `item_id` = `task:${task.id}:${task.day}T${task.remindTime}:${sub.endpoint}`
    - `fire_at` = `'1970-01-01T00:00:00Z'`
    - The claim uses `upsert … ignoreDuplicates … select`, as reminders do.
  - Send only the claimed ones.
- [ ] **Step 4: Run** the Deno tests. Expected: all PASS.
- [ ] **Step 5: Commit** "Send task times as phone notifications".

### Task 3: Switch notifications on in the live project

**Files:**
- Modify: `supabase/migrations/2026-11-13-notifications.sql`, only if running it shows a needed fix (ledger it).

- [ ] **Step 1: Deploy the Edge Function** `notifications` with `index.ts` and `due.ts`, and with JWT verification **off**:
  - The every-minute job calls it with no Authorization header.
  - The app's publishable key is not a JWT.
  - Try the Supabase tool first. If it has no permission, use the dashboard (Edge Functions → Deploy a new function → Via editor) while the person is signed in.
- [ ] **Step 2: Run the SQL** `2026-11-13-notifications.sql` in the SQL editor.
- [ ] **Step 3: Verify:**
  - `GET` the function URL returns 200 with `publicKey`.
  - `POST {"action":"tick"}` returns 200 with `{"subscriptions":0,"sent":0}`, or a count if a phone is already signed up.
  - `select jobname, schedule from cron.job` shows `minders-notifications` with `* * * * *`.
  - `select count(*) from net._http_response where created > now() - interval '3 minutes'` is at least 1, and the latest status is 200.
  - Without signing in, `push_subscriptions` can't be read through REST (no rows or an error).
- [ ] **Step 4: Commit** any SQL fix.

### Task 4: Ship

- [ ] **Step 1:** Run the final whole-branch review and its fix pass, as in executing-plans.
- [ ] **Step 2:** `npm run build` with the real `.env.local`, then push `feature/supabase-sync`.
- [ ] **Step 3:** Check the live site's Today chunk contains "Notify me at".
- [ ] **Step 4:** Tell the person the one-time iPhone steps. Ask them to tap "Send a test" on the Notifications page and confirm it arrives. That last check is theirs, on their phone.
