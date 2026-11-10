"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { buildBackup, saveBackupFile } from "@/lib/backup";
import { relativeDay } from "@/lib/dates";
import { markBackedUp, showMessage } from "@/lib/store";
import type { AppState } from "@/lib/types";

export function BackupButton({ state, now }: { state: AppState; now: Date }) {
  const [saving, setSaving] = useState(false);
  const count =
    state.modules.length + state.notes.length + state.reminders.length + state.tasks.length + state.budgetCategories.length + state.budgetItems.length;

  async function download() {
    setSaving(true);
    try {
      const current = new Date();
      const { name, text } = buildBackup(state, current);
      if (await saveBackupFile(name, text)) {
        markBackedUp(current.toISOString());
        showMessage("Backup saved", name);
      }
    } catch {
      showMessage("Could not save the backup", "Try again, or try from another browser.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="backup">
      <div>
        <b>Backup</b>
        <small>
          {state.lastBackupAt
            ? `Last downloaded ${relativeDay(new Date(state.lastBackupAt), now).replace("Today", "today").replace("Yesterday", "yesterday")}`
            : "Keep a copy of everything in a file"}
        </small>
      </div>
      <button className="theme-btn" type="button" disabled={saving || count === 0} onClick={download}>
        <Icon name="download" small />
        Download backup
      </button>
    </div>
  );
}
