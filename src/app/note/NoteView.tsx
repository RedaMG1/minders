"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AutoTextarea } from "@/components/AutoTextarea";
import { Icon } from "@/components/Icon";
import { addDays, clock, dayKey, relativeDay } from "@/lib/dates";
import { pickPool, pickRandom } from "@/lib/randomiser";
import { addTask, deleteNote, newId, saveNote, showMessage, useApp } from "@/lib/store";
import type { ChecklistItem, Note } from "@/lib/types";

function Editor({ note, moduleName, saved, now }: { note: Note; moduleName: string; saved: boolean; now: Date }) {
  const router = useRouter();
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const update = (change: Partial<Note>) => saveNote({ ...note, ...change });
  const updateItem = (id: string, change: Partial<ChecklistItem>) =>
    update({ items: note.items.map((item) => (item.id === id ? { ...item, ...change } : item)) });

  function addItem() {
    const item = { id: newId(), text: "", done: false };
    update({ items: [...note.items, item] });
    setFocusItem(item.id);
  }

  function addToTomorrow() {
    const title = note.title.trim() || "Untitled note";
    addTask(title, dayKey(addDays(new Date(), 1)));
    showMessage("Added to tomorrow", title);
  }

  function remove() {
    deleteNote(note.id);
    router.push(`/module?id=${note.moduleId}`);
  }

  const hasContent = Boolean(note.title.trim() || note.body.trim() || note.items.length);
  // Picks for items that were deleted since are ignored.
  const picked = (note.picked ?? []).filter((id) => note.items.some((item) => item.id === id));
  const poolSize = pickPool(note.items).length;

  return (
    <div className="screen">
      <div className="status" />
      <div className="editor-bar">
        <Link className="back" href={`/module?id=${note.moduleId}`}>
          <Icon name="back" />
          {moduleName}
        </Link>
        <button
          className={note.pinned ? "icon-btn plain row-btn on" : "icon-btn plain"}
          type="button"
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={note.pinned}
          disabled={!hasContent}
          onClick={() => update({ pinned: !note.pinned })}
        >
          <Icon name="pin" />
        </button>
        {saved && (
          <button className="icon-btn plain" type="button" aria-label="Delete note" onClick={() => setConfirming(true)}>
            <Icon name="trash" />
          </button>
        )}
      </div>

      <div className="scroll editor">
        {confirming && (
          <div className="confirm">
            <p>Delete this note? You can&apos;t undo this.</p>
            <button className="danger solid" type="button" onClick={remove}>
              Delete note
            </button>
            <button className="ghost" type="button" onClick={() => setConfirming(false)}>
              Keep note
            </button>
          </div>
        )}
        <p className="saved">
          {saved
            ? `Saved, ${relativeDay(new Date(note.updatedAt), now).toLowerCase()} at ${clock(new Date(note.updatedAt))}`
            : "Saves as you type"}
        </p>
        <AutoTextarea
          className="note-title"
          id="note-title"
          placeholder="Title"
          aria-label="Note title"
          value={note.title}
          maxLength={120}
          onChange={(event) => update({ title: event.target.value.replace(/\n/g, " ") })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              document.getElementById("note-body")?.focus();
            }
          }}
        />
        <AutoTextarea
          className="note-body"
          id="note-body"
          placeholder="Write your note"
          aria-label="Note text"
          value={note.body}
          onChange={(event) => update({ body: event.target.value })}
        />
        {note.items.length > 0 && (
          <div>
            {note.items.map((item) => (
              <div className={picked.includes(item.id) ? "task-row check-row picked" : "task-row check-row"} key={item.id}>
                <span className="task">
                  <input
                    type="checkbox"
                    id={`check-${item.id}`}
                    aria-label={`Mark ${item.text || "item"} as done`}
                    checked={item.done}
                    onChange={() => updateItem(item.id, { done: !item.done })}
                  />
                  <AutoTextarea
                    className="check-input"
                    id={`text-${item.id}`}
                    placeholder="List item"
                    aria-label="List item"
                    value={item.text}
                    autoFocus={item.id === focusItem}
                    onChange={(event) => updateItem(item.id, { text: event.target.value.replace(/\n/g, " ") })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addItem();
                      }
                    }}
                  />
                </span>
                <button
                  className="row-btn"
                  type="button"
                  aria-label={`Remove ${item.text || "item"}`}
                  onClick={() =>
                    update({
                      items: note.items.filter((other) => other.id !== item.id),
                      picked: picked.filter((id) => id !== item.id),
                    })
                  }
                >
                  <Icon name="x" />
                </button>
              </div>
            ))}
            {poolSize > 0 && (
              <div className="randomiser">
                <button
                  className="randomiser-btn"
                  type="button"
                  onClick={() => update({ picked: pickRandom(note.items, picked) })}
                >
                  <Icon name="shuffle" small />
                  Randomiser
                </button>
                {picked.length > 0 && (
                  <>
                    <span className="randomiser-note" role="status">
                      {picked.length} picked at random
                    </span>
                    <button className="ghost" type="button" onClick={() => update({ picked: [] })}>
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="toolbar">
        <button className="icon-btn plain" type="button" aria-label="Add a list item" onClick={addItem}>
          <Icon name="list" />
        </button>
        <button className="send" type="button" disabled={!hasContent} onClick={addToTomorrow}>
          <Icon name="moon" small />
          Add to tomorrow
        </button>
      </div>
    </div>
  );
}

export function NoteView() {
  const app = useApp();
  const params = useSearchParams();
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const id = params.get("id");
  const existing = state.notes.find((note) => note.id === id);
  const moduleId = existing?.moduleId ?? params.get("module");
  const owner = state.modules.find((item) => item.id === moduleId);

  if (!id || !owner) {
    return (
      <div className="screen">
        <div className="status" />
        <div className="missing">
          <h1 className="day-title">Note not found</h1>
          <p>It may have been deleted.</p>
          <Link className="chip" href="/">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // A new note only exists as a draft until something is typed in it.
  const note: Note = existing ?? {
    id,
    moduleId: owner.id,
    title: "",
    body: "",
    items: [],
    pinned: false,
    updatedAt: now.toISOString(),
  };

  return <Editor note={note} moduleName={owner.name} saved={Boolean(existing)} now={now} />;
}
