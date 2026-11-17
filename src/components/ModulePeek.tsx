"use client";

import Link from "next/link";
import { whenLabel } from "@/lib/dates";
import { toggleNoteItem, useApp } from "@/lib/store";
import { Icon } from "./Icon";

/** What's inside a module, shown under a task that stands for the whole module. Checklist items can be ticked here. */
export function ModulePeek({ moduleId }: { moduleId: string }) {
  const app = useApp();
  if (!app) return null;
  const { state, now } = app;
  const topic = state.modules.find((item) => item.id === moduleId);

  if (!topic) {
    return (
      <div className="module-peek">
        <p className="peek-empty">This module was deleted.</p>
      </div>
    );
  }

  const notes = state.notes
    .filter((note) => note.moduleId === topic.id)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const reminders = state.reminders
    .filter((reminder) => reminder.moduleId === topic.id)
    .sort((a, b) => a.at.localeCompare(b.at));
  const empty = topic.type === "notes" ? notes.length === 0 : reminders.length === 0;

  return (
    <div className="module-peek">
      {empty && <p className="peek-empty">Nothing in this module yet.</p>}

      {topic.type === "notes" &&
        notes.map((note) => {
          const items = note.items.filter((item) => item.text.trim());
          const left = items.filter((item) => !item.done).length;
          return (
            <div className="peek-note" key={note.id}>
              <Link className="peek-title" href={`/note?id=${note.id}`}>
                <span>{note.title.trim() || "Untitled note"}</span>
                {items.length > 0 && (
                  <small>
                    {left === 0 ? "All done" : `${left} left`}
                  </small>
                )}
                <Icon name="arrow" small />
              </Link>
              {items.map((item) => (
                <label className="peek-item" key={item.id}>
                  <input
                    type="checkbox"
                    id={`peek-${item.id}`}
                    checked={item.done}
                    onChange={() => toggleNoteItem(note.id, item.id)}
                  />
                  <span>{item.text}</span>
                </label>
              ))}
              {items.length === 0 && note.body.trim() && <p className="peek-body">{note.body.trim()}</p>}
            </div>
          );
        })}

      {topic.type === "reminders" &&
        reminders.map((reminder) => (
          <div className="peek-reminder" key={reminder.id}>
            <Icon name="bell" small />
            <span>{reminder.title}</span>
            <small>{reminder.firedAt ? "Sent" : whenLabel(new Date(reminder.at), now)}</small>
          </div>
        ))}

      <Link className="peek-open" href={`/module?id=${topic.id}`}>
        Open {topic.name}
        <Icon name="arrow" small />
      </Link>
    </div>
  );
}
