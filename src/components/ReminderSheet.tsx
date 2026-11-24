"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { addDays, atTime, toInputValue, whenLabel } from "@/lib/dates";
import { deleteReminder, newId, saveReminder } from "@/lib/store";
import type { Reminder, Repeat } from "@/lib/types";

type When = "hour" | "evening" | "morning" | "pick";

const REPEATS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function presetTime(when: Exclude<When, "pick">, now: Date) {
  if (when === "hour") return new Date(now.getTime() + 60 * 60 * 1000);
  if (when === "morning") return atTime(addDays(now, 1), 8);
  const evening = atTime(now, 20);
  return evening > now ? evening : addDays(evening, 1);
}

type ReminderSheetProps = {
  moduleId: string;
  moduleName: string;
  reminder?: Reminder;
  now: Date;
  onClose: () => void;
};

export function ReminderSheet({ moduleId, moduleName, reminder, now, onClose }: ReminderSheetProps) {
  const [title, setTitle] = useState(reminder?.title ?? "");
  const [when, setWhen] = useState<When>(reminder ? "pick" : "morning");
  const [picked, setPicked] = useState(toInputValue(reminder ? new Date(reminder.at) : addDays(now, 1)));
  const [repeat, setRepeat] = useState<Repeat>(reminder?.repeat ?? "none");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const current = new Date();
    const at = when === "pick" ? new Date(picked) : presetTime(when, current);
    if (Number.isNaN(at.getTime()) || at <= current) {
      setError("Choose a time in the future.");
      return;
    }
    saveReminder({
      id: reminder?.id ?? newId(),
      moduleId,
      title: trimmed,
      at: at.toISOString(),
      repeat,
      lastFiredAt: reminder?.lastFiredAt,
    });
    onClose();
  }

  function remove() {
    if (reminder) deleteReminder(reminder.id);
    onClose();
  }

  const options: { value: When; label: string; detail: string }[] = [
    { value: "hour", label: "In 1 hour", detail: whenLabel(presetTime("hour", now), now) },
    { value: "evening", label: "This evening", detail: whenLabel(presetTime("evening", now), now) },
    { value: "morning", label: "Tomorrow morning", detail: whenLabel(presetTime("morning", now), now) },
    { value: "pick", label: "Pick a time", detail: "Date and time" },
  ];

  return (
    <Sheet title={reminder ? "Edit reminder" : `New reminder in ${moduleName}`} onClose={onClose} onSubmit={submit}>
      <label className="field">
        <span>Remind me to</span>
        <input
          className="text-field"
          id="reminder-title"
          type="text"
          value={title}
          placeholder="For example Renew the insurance"
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <fieldset className="field">
        <legend>When</legend>
        <div className="when">
          {options.map((option) => (
            <span key={option.value} style={{ display: "grid" }}>
              <input
                className="chip-input"
                type="radio"
                name="when"
                id={`when-${option.value}`}
                checked={when === option.value}
                onChange={() => {
                  setWhen(option.value);
                  setError("");
                }}
              />
              <label className="when-opt" htmlFor={`when-${option.value}`}>
                <b>{option.label}</b>
                <small>{option.detail}</small>
              </label>
            </span>
          ))}
        </div>
      </fieldset>

      {when === "pick" && (
        <label className="field">
          <span>Date and time</span>
          <input
            className="text-field"
            id="reminder-time"
            type="datetime-local"
            value={picked}
            onChange={(event) => {
              setPicked(event.target.value);
              setError("");
            }}
          />
        </label>
      )}

      <fieldset className="field">
        <legend>Repeat</legend>
        <div className="chips">
          {REPEATS.map((option) => (
            <span key={option.value}>
              <input
                className="chip-input"
                type="radio"
                name="repeat"
                id={`repeat-${option.value}`}
                checked={repeat === option.value}
                onChange={() => setRepeat(option.value)}
              />
              <label className="chip" htmlFor={`repeat-${option.value}`}>
                {option.label}
              </label>
            </span>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button className="primary" type="submit" disabled={!title.trim()}>
        {reminder ? "Save changes" : "Set reminder"}
      </button>
      {reminder && (
        <button className="danger" type="button" onClick={remove}>
          Delete reminder
        </button>
      )}
    </Sheet>
  );
}
