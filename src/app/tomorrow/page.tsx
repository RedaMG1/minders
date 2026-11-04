"use client";

import { Icon } from "@/components/Icon";
import { QuickAdd } from "@/components/QuickAdd";
import { TabBar } from "@/components/TabBar";
import { TaskRow } from "@/components/TaskRow";
import { addDays, dayKey, dayMonthLong, weekdayLong } from "@/lib/dates";
import { moveTask, setFirstTask, tasksForTomorrow, toggleTask, useApp } from "@/lib/store";

export default function TomorrowPage() {
  const app = useApp();
  if (!app) return <div className="screen night" />;

  const { state, now } = app;
  const tomorrow = addDays(now, 1);
  const tasks = tasksForTomorrow(state.tasks, now);
  const first = tasks.find((task) => task.first);
  const others = tasks.filter((task) => !task.first);

  return (
    <div className="screen night">
      <div className="status" />
      <div className="tomorrow-head">
        <svg className="stars" viewBox="0 0 124 84" aria-hidden="true">
          <path d="M88 8a26 26 0 1 0 26 34A21 21 0 0 1 88 8z" fill="var(--moon)" />
          <g fill="var(--star)">
            <circle cx="20" cy="22" r="2" />
            <circle cx="44" cy="8" r="1.5" />
            <circle cx="50" cy="44" r="1.5" />
            <circle cx="8" cy="52" r="1.5" />
            <circle cx="118" cy="14" r="1.5" />
          </g>
        </svg>
        <p className="day-label">{weekdayLong(tomorrow)}</p>
        <h1 className="day-title">{dayMonthLong(tomorrow)}</h1>
      </div>

      <div className="scroll tomorrow-body">
        {first ? (
          <div className="first-thing">
            <label className="first-label">
              <input
                type="checkbox"
                id={`task-${first.id}`}
                checked={first.done}
                onChange={() => toggleTask(first.id)}
              />
              <span>
                <span className="label">First thing</span>
                <strong>{first.title}</strong>
              </span>
            </label>
            <button
              className="row-btn"
              type="button"
              aria-label={`Remove ${first.title} as first thing`}
              onClick={() => setFirstTask(first.id)}
            >
              <Icon name="star" />
            </button>
          </div>
        ) : (
          <p className="first-empty">
            <b>Pick your first thing</b>
            Add a task below, then tap its star to choose what matters most.
          </p>
        )}

        <p className="section-label">{first ? "Also tomorrow" : "Tomorrow"}</p>
        {others.length === 0 && <p className="empty">Nothing else planned yet.</p>}
        {others.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            tag={task.moved ? "From today" : undefined}
            actions={
              <>
                <button
                  className="row-btn"
                  type="button"
                  aria-label={`Make ${task.title} the first thing`}
                  onClick={() => setFirstTask(task.id)}
                >
                  <Icon name="star" />
                </button>
                <button
                  className="row-btn"
                  type="button"
                  aria-label={`Move ${task.title} to today`}
                  onClick={() => moveTask(task.id, dayKey(now), false)}
                >
                  <Icon name="sun" />
                </button>
              </>
            }
          />
        ))}
      </div>

      <QuickAdd id="add-tomorrow" day={dayKey(tomorrow)} placeholder="What do you want to do tomorrow?" />
      <TabBar />
    </div>
  );
}
