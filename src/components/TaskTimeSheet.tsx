"use client";

import { useState, type FormEvent } from "react";
import { setTaskTime } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Sheet } from "./Sheet";

/** Picks the time a task notifies at, on the task's own day. */
export function TaskTimeSheet({ task, title, onClose }: { task: Task; title: string; onClose: () => void }) {
  const [time, setTime] = useState(task.remindTime ?? "09:00");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    setTaskTime(task.id, time);
    onClose();
  }

  return (
    <Sheet title="Notify me at" onClose={onClose} onSubmit={submit}>
      <p className="sheet-hint">{title}</p>
      <label className="field">
        <span>Time</span>
        <input className="text-field" id="task-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
      </label>
      <button className="primary" type="submit" disabled={!time}>
        Save time
      </button>
      {task.remindTime && (
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setTaskTime(task.id, null);
            onClose();
          }}
        >
          Remove time
        </button>
      )}
    </Sheet>
  );
}
