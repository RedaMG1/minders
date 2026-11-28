"use client";

import { useState, type ReactNode } from "react";
import { deleteTask, toggleMustDo, toggleOnHold, toggleTask, useApp } from "@/lib/store";
import { TaskEditSheet } from "./TaskEditSheet";
import { TaskTimeSheet } from "./TaskTimeSheet";
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
  const [timing, setTiming] = useState(false);
  const [editing, setEditing] = useState(false);
  const title = useTaskTitle(task);
  const onHold = Boolean(task.onHold) && !task.done;
  const canTime = !task.done && !onHold;

  return (
    <div
      className={["task-row", task.moduleId && "module-task", task.mustDo && !task.done && !onHold && "must-do", onHold && "on-hold"]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="task">
        {/* The tap area around the circle is a full finger wide. */}
        <label className="task-check">
          <input
            type="checkbox"
            id={`task-${task.id}`}
            aria-label={`Mark ${title} done`}
            checked={task.done}
            onChange={() => toggleTask(task.id)}
          />
        </label>
        <span className="task-body">
          {/* Tapping the name edits it; a module task keeps its module's name, so it shows the module instead. */}
          <button
            className="task-text task-name"
            type="button"
            aria-label={task.moduleId ? undefined : `Edit ${title}`}
            onClick={() => (task.moduleId ? setOpen(!open) : setEditing(true))}
          >
            {title}
          </button>
          {onHold && (
            <span className="tag hold-tag">
              <Icon name="pause" small />
              On hold
            </span>
          )}
          {task.remindTime && canTime && (
            <span className="tag time-tag">
              <Icon name="bell" small />
              {task.remindTime}
            </span>
          )}
          {task.mustDo && !task.done && !onHold && (
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
      </div>
      {/* The buttons stay together, and move under the task as a group when the row is short of room. */}
      <span className="task-actions">
        {task.moduleId && <PeekButton title={title} open={open} onToggle={() => setOpen(!open)} />}
        {canTime && (
          <button
            className={task.remindTime ? "row-btn time-btn on" : "row-btn time-btn"}
            type="button"
            aria-label={task.remindTime ? `Change the time for ${title}` : `Set a time for ${title}`}
            onClick={() => setTiming(true)}
          >
            <Icon name="bell" />
          </button>
        )}
        {!task.done && (
          <button
            className={onHold ? "row-btn hold-btn on" : "row-btn hold-btn"}
            type="button"
            aria-label={onHold ? `Resume ${title}` : `Put ${title} on hold`}
            aria-pressed={onHold}
            onClick={() => toggleOnHold(task.id)}
          >
            <Icon name="pause" />
          </button>
        )}
        {!task.done && !onHold && (
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
        {!onHold && actions}
        <button className="row-btn" type="button" aria-label={`Delete ${title}`} onClick={() => deleteTask(task.id)}>
          <Icon name="x" />
        </button>
      </span>
      {task.moduleId && open && <ModulePeek moduleId={task.moduleId} />}
      {timing && <TaskTimeSheet task={task} title={title} onClose={() => setTiming(false)} />}
      {editing && <TaskEditSheet task={task} onClose={() => setEditing(false)} />}
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
