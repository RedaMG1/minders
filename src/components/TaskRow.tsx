import type { ReactNode } from "react";
import { deleteTask, toggleTask } from "@/lib/store";
import type { Task } from "@/lib/types";
import { Icon } from "./Icon";

type TaskRowProps = {
  task: Task;
  tag?: string;
  /** Extra buttons, such as moving the task to another day. */
  actions?: ReactNode;
};

export function TaskRow({ task, tag, actions }: TaskRowProps) {
  return (
    <div className="task-row">
      <label className="task">
        <input type="checkbox" id={`task-${task.id}`} checked={task.done} onChange={() => toggleTask(task.id)} />
        <span className="task-body">
          <span className="task-text">{task.title}</span>
          {tag && <span className="tag carried">{tag}</span>}
        </span>
      </label>
      {actions}
      <button className="row-btn" type="button" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task.id)}>
        <Icon name="x" />
      </button>
    </div>
  );
}
