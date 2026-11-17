"use client";

import { useState, type ReactNode } from "react";
import { deleteTask, toggleTask, useApp } from "@/lib/store";
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
    <div className={task.moduleId ? "task-row module-task" : "task-row"}>
      <label className="task">
        <input type="checkbox" id={`task-${task.id}`} checked={task.done} onChange={() => toggleTask(task.id)} />
        <span className="task-body">
          <span className="task-text">{title}</span>
          {task.moduleId && (
            <span className="tag module-tag">
              <Icon name="grid" small />
              Module
            </span>
          )}
          {tag && <span className="tag carried">{tag}</span>}
        </span>
      </label>
      {task.moduleId && <PeekButton title={title} open={open} onToggle={() => setOpen(!open)} />}
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
