"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TabBar } from "@/components/TabBar";
import { TaskRow } from "@/components/TaskRow";
import { addDays, clock, dayKey, shortDate } from "@/lib/dates";
import { doneHistory, useApp } from "@/lib/store";

const WEEK_DAYS = 7;

function dayHeading(day: string, now: Date) {
  if (day === dayKey(now)) return "Today";
  if (day === dayKey(addDays(now, -1))) return "Yesterday";
  return shortDate(new Date(`${day}T12:00`));
}

export default function HistoryPage() {
  const app = useApp();
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const groups = doneHistory(state.tasks);
  const weekStart = dayKey(addDays(now, -(WEEK_DAYS - 1)));
  const thisWeek = groups.filter((group) => group.day >= weekStart).reduce((sum, group) => sum + group.tasks.length, 0);

  return (
    <div className="screen">
      <div className="status" />
      <div className="editor-bar">
        <Link className="back" href="/today">
          <Icon name="back" />
          Today
        </Link>
      </div>
      <div className="page-head">
        <div>
          <h1 className="day-title">History</h1>
          {groups.length > 0 && (
            <p className="history-summary">
              {thisWeek} {thisWeek === 1 ? "task" : "tasks"} done in the last {WEEK_DAYS} days
            </p>
          )}
        </div>
      </div>
      <div className="scroll reminder-list">
        {groups.length === 0 && (
          <p className="empty">
            <b>Nothing done yet</b>
            Tasks you tick off on Today or Tomorrow appear here, grouped by day.
          </p>
        )}
        {groups.map((group) => (
          <section key={group.day}>
            <h2 className="group-head">
              {dayHeading(group.day, now)}
              <span className="group-count">{group.tasks.length}</span>
            </h2>
            {group.tasks.map((task) => (
              <TaskRow key={task.id} task={task} tag={task.doneAt ? clock(new Date(task.doneAt)) : undefined} />
            ))}
          </section>
        ))}
      </div>
      <TabBar />
    </div>
  );
}
