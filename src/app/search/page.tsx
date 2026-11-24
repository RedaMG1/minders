"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, ModuleIcon } from "@/components/Icon";
import { TabBar } from "@/components/TabBar";
import { dayKey, relativeDay, whenLabel } from "@/lib/dates";
import { useApp } from "@/lib/store";

export default function SearchPage() {
  const app = useApp();
  const [query, setQuery] = useState("");
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const term = query.trim().toLowerCase();
  const matches = (...texts: string[]) => texts.some((text) => text.toLowerCase().includes(term));

  const modules = term ? state.modules.filter((module) => matches(module.name)) : [];
  const notes = term
    ? state.notes.filter((note) => matches(note.title, note.body, ...note.items.map((item) => item.text)))
    : [];
  const reminders = term ? state.reminders.filter((reminder) => matches(reminder.title)) : [];
  const tasks = term ? state.tasks.filter((task) => matches(task.title)) : [];
  const moduleName = (id: string) => state.modules.find((module) => module.id === id)?.name ?? "";
  const nothing = !modules.length && !notes.length && !reminders.length && !tasks.length;

  return (
    <div className="screen">
      <div className="status" />
      <div className="editor-bar">
        <Link className="back" href="/">
          <Icon name="back" />
          Home
        </Link>
      </div>
      <div className="page-head">
        <h1 className="day-title">Search</h1>
      </div>
      <label className="search">
        <Icon name="search" />
        <input
          id="search-all"
          type="search"
          placeholder="Search everything"
          aria-label="Search everything"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="scroll results">
        {term && nothing && (
          <p className="empty">
            <b>Nothing found</b>
            Try a different word.
          </p>
        )}
        {modules.map((module) => (
          <Link className={`result t-${module.color}`} href={`/module?id=${module.id}`} key={module.id}>
            <ModuleIcon name={module.icon} />
            <div>
              <b>{module.name}</b>
              <small>Module</small>
            </div>
          </Link>
        ))}
        {notes.map((note) => (
          <Link className="result" href={`/note?id=${note.id}`} key={note.id}>
            <Icon name="note" />
            <div>
              <b>{note.title || "Untitled note"}</b>
              <small>
                {moduleName(note.moduleId)}, {relativeDay(new Date(note.updatedAt), now)}
              </small>
            </div>
          </Link>
        ))}
        {reminders.map((reminder) => (
          <Link className="result" href={`/module?id=${reminder.moduleId}`} key={reminder.id}>
            <Icon name="bell" />
            <div>
              <b>{reminder.title}</b>
              <small>
                {moduleName(reminder.moduleId)}, {whenLabel(new Date(reminder.firedAt ?? reminder.at), now)}
              </small>
            </div>
          </Link>
        ))}
        {tasks.map((task) => (
          <Link className="result" href={task.day > dayKey(now) ? "/tomorrow" : "/today"} key={task.id}>
            <Icon name={task.day > dayKey(now) ? "moon" : "sun"} />
            <div>
              <b>{task.title}</b>
              <small>{task.done ? "Done" : "Task"}</small>
            </div>
          </Link>
        ))}
      </div>
      <TabBar />
    </div>
  );
}
