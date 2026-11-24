"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { addTask } from "@/lib/store";

export function QuickAdd({ id, day, placeholder }: { id: string; day: string; placeholder: string }) {
  const [title, setTitle] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addTask(trimmed, day);
    setTitle("");
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        aria-label={placeholder}
        value={title}
        maxLength={160}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button className="add-btn" type="submit" aria-label="Add" disabled={!title.trim()}>
        <Icon name="plus" />
      </button>
    </form>
  );
}
