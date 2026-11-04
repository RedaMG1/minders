"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { MODULE_COLORS, MODULE_ICONS } from "@/lib/options";
import { deleteModule, newId, saveModule } from "@/lib/store";
import type { Module, ModuleType } from "@/lib/types";

type ModuleSheetProps = {
  module?: Module;
  /** How many notes or reminders would be deleted along with this module. */
  itemCount?: number;
  onClose: () => void;
};

export function ModuleSheet({ module, itemCount = 0, onClose }: ModuleSheetProps) {
  const router = useRouter();
  const [name, setName] = useState(module?.name ?? "");
  const [type, setType] = useState<ModuleType>(module?.type ?? "notes");
  const [icon, setIcon] = useState<string>(module?.icon ?? MODULE_ICONS[0].value);
  const [color, setColor] = useState(module?.color ?? MODULE_COLORS[0].value);
  const [confirming, setConfirming] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (module) {
      saveModule({ ...module, name: trimmed, icon, color });
      onClose();
      return;
    }
    const id = newId();
    saveModule({ id, name: trimmed, icon, color, type, createdAt: new Date().toISOString() });
    router.push(`/module?id=${id}`);
  }

  function remove() {
    if (!module) return;
    deleteModule(module.id);
    router.push("/");
  }

  const itemWord = module?.type === "reminders" ? "reminder" : "note";

  return (
    <Sheet title={module ? "Edit module" : "New module"} onClose={onClose} onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input
          className="text-field"
          id="module-name"
          type="text"
          value={name}
          placeholder="For example Travel, Car or Work"
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {module ? (
        <p className="field-hint">
          This module holds {module.type}. That can&apos;t be changed after creating it.
        </p>
      ) : (
        <fieldset className="field">
          <legend>What will it hold?</legend>
          <div className="when">
            <input
              className="chip-input"
              type="radio"
              name="module-type"
              id="type-notes"
              checked={type === "notes"}
              onChange={() => setType("notes")}
            />
            <label className="when-opt" htmlFor="type-notes">
              <Icon name="note" />
              <b>Notes</b>
              <small>Text, lists and ideas</small>
            </label>
            <input
              className="chip-input"
              type="radio"
              name="module-type"
              id="type-reminders"
              checked={type === "reminders"}
              onChange={() => setType("reminders")}
            />
            <label className="when-opt" htmlFor="type-reminders">
              <Icon name="bell" />
              <b>Reminders</b>
              <small>Alerts at set times</small>
            </label>
          </div>
        </fieldset>
      )}

      <fieldset className="field">
        <legend>Icon</legend>
        <div className="pick-row">
          {MODULE_ICONS.map((option) => (
            <span key={option.value}>
              <input
                className="chip-input"
                type="radio"
                name="module-icon"
                id={`icon-${option.value}`}
                checked={icon === option.value}
                onChange={() => setIcon(option.value)}
              />
              <label className="pick" htmlFor={`icon-${option.value}`} aria-label={option.label}>
                <Icon name={option.value} />
              </label>
            </span>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Color</legend>
        <div className="pick-row">
          {MODULE_COLORS.map((option) => (
            <span key={option.value}>
              <input
                className="chip-input"
                type="radio"
                name="module-color"
                id={`color-${option.value}`}
                checked={color === option.value}
                onChange={() => setColor(option.value)}
              />
              <label
                className={`swatch t-${option.value}`}
                style={{ display: "block" }}
                htmlFor={`color-${option.value}`}
                aria-label={option.label}
              />
            </span>
          ))}
        </div>
      </fieldset>

      <button className="primary" type="submit" disabled={!name.trim()}>
        {module ? "Save changes" : "Create module"}
      </button>

      {module &&
        (confirming ? (
          <div className="confirm">
            <p>
              Delete {module.name}
              {itemCount > 0 && ` and its ${itemCount} ${itemWord}${itemCount === 1 ? "" : "s"}`}? You can&apos;t undo this.
            </p>
            <button className="danger solid" type="button" onClick={remove}>
              Delete module
            </button>
            <button className="ghost" type="button" onClick={() => setConfirming(false)}>
              Keep module
            </button>
          </div>
        ) : (
          <button className="danger" type="button" onClick={() => setConfirming(true)}>
            Delete module
          </button>
        ))}
    </Sheet>
  );
}
