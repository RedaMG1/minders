"use client";

import { useState, type FormEvent } from "react";
import { setTaskTitle } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Sheet } from "./Sheet";

/** Renames a task. */
export function TaskEditSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const [title, setTitle] = useState(task.title);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setTaskTitle(task.id, title);
    onClose();
  }

  return (
    <Sheet title="Edit task" onClose={onClose} onSubmit={submit}>
      <label className="field">
        <span>Task</span>
        <input
          className="text-field"
          id="task-name"
          type="text"
          value={title}
          maxLength={160}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <button className="primary" type="submit" disabled={!title.trim()}>
        Save
      </button>
    </Sheet>
  );
}
