"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { ReminderRowButton } from "@/components/ReminderRowButton";
import { ReminderSheet } from "@/components/ReminderSheet";
import { TabBar } from "@/components/TabBar";
import { addDays, dayKey, weekdayDay } from "@/lib/dates";
import { todaysReminderRows, upcomingReminders, useApp, type ReminderRow } from "@/lib/store";

export default function RemindersPage() {
  const app = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const tomorrowKey = dayKey(addDays(now, 1));
  const todayKey = dayKey(now);
  const upcoming = upcomingReminders(state.reminders).map(
    (reminder): ReminderRow => ({ reminder, at: new Date(reminder.at), sent: false }),
  );
  const groups: { title: string; icon: IconName; rows: ReminderRow[]; showDate?: boolean }[] = [
    { title: "Today", icon: "sun", rows: todaysReminderRows(state.reminders, now) },
    { title: "Tomorrow", icon: "moon", rows: upcoming.filter((row) => dayKey(row.at) === tomorrowKey) },
    {
      title: "Later",
      icon: "arrow",
      rows: upcoming.filter((row) => dayKey(row.at) > tomorrowKey || dayKey(row.at) < todayKey),
      showDate: true,
    },
  ];

  const moduleName = (id: string) => state.modules.find((module) => module.id === id)?.name ?? "";
  const open = state.reminders.find((reminder) => reminder.id === openId);

  return (
    <div className="screen">
      <div className="status" />
      <div className="page-head">
        <h1 className="day-title">All reminders</h1>
      </div>
      <div className="scroll reminder-list">
        {groups.every((group) => group.rows.length === 0) && (
          <p className="empty">
            <b>No reminders yet</b>
            Create a reminders module on Home, then add your reminders inside it.
          </p>
        )}
        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <div key={group.title} style={{ display: "grid", gap: 4 }}>
              <h2 className="group-head">
                <Icon name={group.icon} />
                {group.title}
              </h2>
              {group.rows.map((row) => (
                <ReminderRowButton
                  key={`${row.reminder.id}-${row.sent}`}
                  row={row}
                  moduleName={moduleName(row.reminder.moduleId)}
                  dateLabel={group.showDate ? weekdayDay(row.at) : undefined}
                  onOpen={() => setOpenId(row.reminder.id)}
                />
              ))}
            </div>
          ))}
      </div>
      <TabBar />
      {open && (
        <ReminderSheet
          key={open.id}
          moduleId={open.moduleId}
          moduleName={moduleName(open.moduleId)}
          reminder={open}
          now={now}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
