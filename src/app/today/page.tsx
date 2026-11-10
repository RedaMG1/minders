"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { QuickAdd } from "@/components/QuickAdd";
import { SunArc } from "@/components/SunArc";
import { TabBar } from "@/components/TabBar";
import { TaskRow } from "@/components/TaskRow";
import { addDays, clock, dayKey, dayMonthLong, relativeDay, timeUntil, weekdayLong } from "@/lib/dates";
import { moveTask, moveTasks, showMessage, tasksForToday, todaysReminderRows, useApp } from "@/lib/store";

export default function TodayPage() {
  const app = useApp();
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const todayKey = dayKey(now);
  const tomorrowKey = dayKey(addDays(now, 1));
  const tasks = tasksForToday(state.tasks, now);
  const todo = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);
  const rows = todaysReminderRows(state.reminders, now);
  const next = rows.find((row) => !row.sent);

  return (
    <div className="screen">
      <div className="today-top">
        <div className="status" />
        <div className="today-head with-action">
          <div>
            <p className="day-label">{weekdayLong(now)}</p>
            <h1 className="day-title">{dayMonthLong(now)}</h1>
          </div>
          <Link className="header-pill" href="/history">
            <Icon name="history" small />
            History
          </Link>
        </div>
        <SunArc rows={rows} now={now} done={done.length} total={tasks.length} />
      </div>

      <div className="today-sheet">
        <div className="scroll">
          {next && (
            <div className="next-up">
              <span className="ring">
                <Icon name="bell" />
              </span>
              <div>
                <b>{next.reminder.title}</b>
                <small>
                  {clock(next.at)}, {timeUntil(next.at, now)}
                </small>
              </div>
            </div>
          )}

          <p className="section-label">To do</p>
          {todo.length === 0 && (
            <p className="empty">
              <b>{tasks.length ? "All done for today" : "Nothing planned for today"}</b>
              Add something in the box below.
            </p>
          )}
          {todo.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              tag={task.day < todayKey ? `From ${relativeDay(new Date(`${task.day}T12:00`), now).replace("Yesterday", "yesterday")}` : undefined}
              actions={
                <button
                  className="later-btn"
                  type="button"
                  aria-label={`Move ${task.title} to tomorrow`}
                  onClick={() => moveTask(task.id, tomorrowKey, true)}
                >
                  Tomorrow
                  <Icon name="arrow" small />
                </button>
              }
            />
          ))}
          {todo.length > 1 && (
            <button
              className="move-all"
              type="button"
              onClick={() => {
                moveTasks(
                  todo.map((task) => task.id),
                  tomorrowKey,
                );
                showMessage(`Moved ${todo.length} tasks to tomorrow`);
              }}
            >
              <Icon name="moon" small />
              Move all {todo.length} unfinished to tomorrow
            </button>
          )}

          {done.length > 0 && <p className="section-label">Done</p>}
          {done.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
        <QuickAdd id="add-today" day={todayKey} placeholder="Add something for today" />
        <TabBar />
      </div>
    </div>
  );
}
