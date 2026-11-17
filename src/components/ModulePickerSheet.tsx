"use client";

import { addTask, showMessage, useApp } from "@/lib/store";
import { Icon, ModuleIcon } from "./Icon";
import { Sheet } from "./Sheet";

/** Lists the modules so a whole one can be planned for a day. */
export function ModulePickerSheet({ day, onClose }: { day: string; onClose: () => void }) {
  const app = useApp();
  if (!app) return null;
  const { state } = app;
  const planned = new Set(state.tasks.filter((task) => task.day === day && task.moduleId).map((task) => task.moduleId));
  const modules = [...state.modules].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <Sheet title="Add a module" onClose={onClose} onSubmit={(event) => event.preventDefault()}>
      {modules.length === 0 && (
        <p className="empty">
          <b>No modules yet</b>
          Create one on Home first.
        </p>
      )}
      <div className="pick-modules">
        {modules.map((module) => {
          const added = planned.has(module.id);
          return (
            <button
              key={module.id}
              type="button"
              className={`pick-module t-${module.color}`}
              disabled={added}
              onClick={() => {
                addTask(module.name, day, module.id);
                showMessage("Added to tomorrow", module.name);
                onClose();
              }}
            >
              <span className="tile">
                <ModuleIcon name={module.icon} />
              </span>
              <span className="pick-name">
                <b>{module.name}</b>
                <small>
                  {module.type === "notes" ? "Notes" : "Reminders"}
                  {module.shared && " · Shared"}
                </small>
              </span>
              {added ? <span className="pick-added">Added</span> : <Icon name="plus" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
