# Phone notifications and task times

Date: 2026-11-24. Size: a small change. Approved in conversation ("Yes, build it").

**Why:** notifications only show while Minders is open, so the person has to open the app to see them. They want them to arrive on their phone like any other app's.

**Goals**
- Reminders, the morning summary, and task times arrive on the phone even when Minders is closed.
- A task on Today or Tomorrow can be given a time. At that time the phone shows the task's name; tapping opens Today.

**Non-goals:** a native App Store app; a third-party push service.

**Approaches considered**
- *Switch on the push service already built in the repo (picked).* Supabase Edge Function `notifications` + a database job every minute + Web Push to the installed web app.
- A third-party push service (OneSignal and the like). Rejected: another account, and it adds nothing the repo lacks.
- A native app. Rejected: not free, and the app would have to be rebuilt.

**Decided**
1. Turn on the server side on project `lmaxbibmdytwfujfcqcz`:
   - Deploy the `notifications` Edge Function.
   - Run `supabase/migrations/2026-11-13-notifications.sql`, which adds the tables, the sign-up functions and the every-minute job.
2. Task times:
   - A task can have a time (`HH:MM`). A 🔔 button on task rows on Today and Tomorrow sets or clears it, and the task shows a "🔔 15:00" tag.
   - The time belongs to the task's day: moving the task to another day moves the time with it.
   - It is sent at that time on the phone's clock, once per device, and not if the task is done or on hold by then.
   - If Minders is open at that moment, an in-app message shows too.
3. Each phone only gets its own signed-in account's notifications (already how the service works).
4. The person does the iPhone setup once: Add to Home Screen, open from the icon (iOS 16.4+), then turn notifications on in the app's Notifications page.

**Left to the builder:** where the 🔔 sits in the busy task row; the look of the time picker; how the deploy is done (tool, or the Supabase dashboard while signed in).
