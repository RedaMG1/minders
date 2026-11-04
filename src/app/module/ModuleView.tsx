"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Icon, ModuleIcon } from "@/components/Icon";
import { ModuleSheet } from "@/components/ModuleSheet";
import { ReminderRowButton } from "@/components/ReminderRowButton";
import { ReminderSheet } from "@/components/ReminderSheet";
import { TabBar } from "@/components/TabBar";
import { addDays, relativeDay, shortDate } from "@/lib/dates";
import { newId, upcomingReminders, useApp } from "@/lib/store";
import type { AppState, Module } from "@/lib/types";

type Filter = "all" | "pinned" | "lists" | "week";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pinned", label: "Pinned" },
  { value: "lists", label: "Lists" },
  { value: "week", label: "This week" },
];

function NotesContent({ module, state, now }: { module: Module; state: AppState; now: Date }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const term = query.trim().toLowerCase();
  const weekAgo = addDays(now, -7).toISOString();
  const all = state.notes.filter((note) => note.moduleId === module.id);
  const notes = all
    .filter((note) => {
      if (filter === "pinned" && !note.pinned) return false;
      if (filter === "lists" && !note.items.length) return false;
      if (filter === "week" && note.updatedAt < weekAgo) return false;
      if (!term) return true;
      return [note.title, note.body, ...note.items.map((item) => item.text)].some((text) =>
        text.toLowerCase().includes(term),
      );
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <label className="search">
        <Icon name="search" />
        <input
          id="search-notes"
          type="search"
          placeholder="Search notes"
          aria-label="Search notes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="chips notes-filter" role="group" aria-label="Filter notes">
        {FILTERS.map((option) => (
          <span key={option.value}>
            <input
              className="chip-input"
              type="radio"
              name="filter"
              id={`filter-${option.value}`}
              checked={filter === option.value}
              onChange={() => setFilter(option.value)}
            />
            <label className="chip" htmlFor={`filter-${option.value}`}>
              {option.label}
            </label>
          </span>
        ))}
      </div>
      <div className="scroll">
        {notes.length === 0 ? (
          <div className="notes-empty">
            <p className="empty">
              {all.length ? (
                <>
                  <b>No notes found</b>
                  Try another word or filter.
                </>
              ) : (
                <>
                  <b>No notes yet</b>
                  Tap the plus button to write your first one.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <Link className={note.pinned ? "note sun" : "note"} href={`/note?id=${note.id}`} key={note.id}>
                <h3>{note.title || "Untitled note"}</h3>
                {note.body && <p>{note.body}</p>}
                {note.items.length > 0 && (
                  <ul>
                    {note.items.slice(0, 4).map((item) => (
                      <li className={item.done ? "done" : undefined} key={item.id}>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="note-foot">
                  <span>{note.pinned ? "Pinned" : relativeDay(new Date(note.updatedAt), now)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="fab-wrap">
        <button
          className="fab"
          type="button"
          aria-label="New note"
          onClick={() => router.push(`/note?module=${module.id}&id=${newId()}`)}
        >
          <Icon name="plus" />
        </button>
      </div>
    </>
  );
}

function RemindersContent({
  module,
  state,
  now,
  adding,
  onCloseAdding,
}: {
  module: Module;
  state: AppState;
  now: Date;
  adding: boolean;
  onCloseAdding: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const mine = state.reminders.filter((reminder) => reminder.moduleId === module.id);
  const upcoming = upcomingReminders(mine);
  const past = mine
    .filter((reminder) => reminder.firedAt)
    .sort((a, b) => (b.firedAt ?? "").localeCompare(a.firedAt ?? ""));
  const open = mine.find((reminder) => reminder.id === openId);

  return (
    <>
      <div className="scroll reminder-list in-module">
        {mine.length === 0 && (
          <p className="empty">
            <b>No reminders yet</b>
            Tap the plus button to add your first one.
          </p>
        )}
        {upcoming.map((reminder) => (
          <ReminderRowButton
            key={reminder.id}
            row={{ reminder, at: new Date(reminder.at), sent: false }}
            dateLabel={shortDate(new Date(reminder.at))}
            onOpen={() => setOpenId(reminder.id)}
          />
        ))}
        {past.length > 0 && <h2 className="group-head">Sent</h2>}
        {past.map((reminder) => (
          <ReminderRowButton
            key={reminder.id}
            row={{ reminder, at: new Date(reminder.firedAt ?? reminder.at), sent: true }}
            dateLabel={shortDate(new Date(reminder.firedAt ?? reminder.at))}
            onOpen={() => setOpenId(reminder.id)}
          />
        ))}
      </div>
      {adding && <ReminderSheet moduleId={module.id} moduleName={module.name} now={now} onClose={onCloseAdding} />}
      {open && (
        <ReminderSheet
          key={open.id}
          moduleId={module.id}
          moduleName={module.name}
          reminder={open}
          now={now}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

export function ModuleView() {
  const app = useApp();
  const id = useSearchParams().get("id");
  if (!app) return <div className="screen" />;

  const found = app.state.modules.find((item) => item.id === id);

  if (!found) {
    return (
      <div className="screen">
        <div className="status" />
        <div className="missing">
          <h1 className="day-title">Module not found</h1>
          <p>It may have been deleted.</p>
          <Link className="chip" href="/">
            Back to Home
          </Link>
        </div>
        <TabBar />
      </div>
    );
  }

  return <ModuleScreen module={found} state={app.state} now={app.now} />;
}

function ModuleScreen({ module, state, now }: { module: Module; state: AppState; now: Date }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const isNotes = module.type === "notes";
  const itemCount = isNotes
    ? state.notes.filter((note) => note.moduleId === module.id).length
    : state.reminders.filter((reminder) => reminder.moduleId === module.id).length;

  return (
    <div className="screen">
      <div className={`module-top t-${module.color}`}>
        <div className="status" />
        <div className="editor-bar">
          <Link className="back" href="/">
            <Icon name="back" />
            Home
          </Link>
          <button className="icon-btn plain" type="button" aria-label="Edit module" onClick={() => setEditing(true)}>
            <Icon name="edit" />
          </button>
        </div>
        <div className="page-head">
          <div className="module-title">
            <span className="tile">
              <ModuleIcon name={module.icon} />
            </span>
            <div>
              <h1 className="day-title">{module.name}</h1>
              <span className="kind">
                <Icon name={isNotes ? "note" : "bell"} small />
                {isNotes ? "Notes" : "Reminders"}
              </span>
            </div>
          </div>
          {!isNotes && (
            <button className="icon-btn" type="button" aria-label="New reminder" onClick={() => setAdding(true)}>
              <Icon name="plus" />
            </button>
          )}
        </div>
      </div>

      {isNotes ? (
        <NotesContent module={module} state={state} now={now} />
      ) : (
        <RemindersContent
          module={module}
          state={state}
          now={now}
          adding={adding}
          onCloseAdding={() => setAdding(false)}
        />
      )}

      <TabBar />
      {editing && <ModuleSheet module={module} itemCount={itemCount} onClose={() => setEditing(false)} />}
    </div>
  );
}
