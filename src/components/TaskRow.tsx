"use client";

import { useState, type ReactNode } from "react";
import { deleteTask, toggleMustDo, toggleTask, useApp } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Icon } from "./Icon";
import { ModulePeek } from "./ModulePeek";

type TaskRowProps = {
  task: Task;
  tag?: string;
  /** Extra buttons, such as moving the task to another day. */
  actions?: ReactNode;
};

/** The name to show for a task. A module task follows the module's current name. */
export function useTaskTitle(task: Task) {
  const app = useApp();
  const topic = task.moduleId ? app?.state.modules.find((item) => item.id === task.moduleId) : undefined;
  return topic?.name ?? task.title;
}

export function TaskRow({ task, tag, actions }: TaskRowProps) {
  const [open, setOpen] = useState(false);
  const title = useTaskTitle(task);

  return (
    <div className={["task-row", task.moduleId && "module-task", task.mustDo && !task.done && "must-do"].filter(Boolean).join(" ")}>
      <label className="task">
        <input type="checkbox" id={`task-${task.id}`} checked={task.done} onChange={() => toggleTask(task.id)} />
        <span className="task-body">
          <span className="task-text">{title}</span>
          {task.mustDo && !task.done && (
            <span className="tag must-tag">
              <Icon name="bolt" small />
              Must do
            </span>
          )}
          {task.moduleId && (
            <span className="tag module-tag" title="Module">
              <Icon name="grid" small />
              <span className="sr-only">Module</span>
            </span>
          )}
          {tag && <span className="tag carried">{tag}</span>}
        </span>
      </label>
      {task.moduleId && <PeekButton title={title} open={open} onToggle={() => setOpen(!open)} />}
      {!task.done && (
        <button
          className={task.mustDo ? "row-btn must-btn on" : "row-btn must-btn"}
          type="button"
          aria-label={task.mustDo ? `${title} is a must do. Tap to clear` : `Mark ${title} as a must do`}
          aria-pressed={Boolean(task.mustDo)}
          onClick={() => toggleMustDo(task.id)}
        >
          <Icon name="bolt" />
        </button>
      )}
      {actions}
      <button className="row-btn" type="button" aria-label={`Delete ${title}`} onClick={() => deleteTask(task.id)}>
        <Icon name="x" />
      </button>
      {task.moduleId && open && <ModulePeek moduleId={task.moduleId} />}
    </div>
  );
}

export function PeekButton({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      className={open ? "row-btn peek-btn on" : "row-btn peek-btn"}
      type="button"
      aria-label={open ? `Hide what's in ${title}` : `Show what's in ${title}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <Icon name="list" />
    </button>
  );
}
