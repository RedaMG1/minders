"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useAuth } from "@/lib/auth";
import { buildBackup, buildFullBackup, saveBackupFile } from "@/lib/backup";
import { relativeDay } from "@/lib/dates";
import { markBackedUp, showMessage } from "@/lib/store";
import { fetchAllAccounts, isMainAccount } from "@/lib/sync";
import type { AppState } from "@/lib/types";

export function BackupButton({ state, now }: { state: AppState; now: Date }) {
  const auth = useAuth();
  const userId = auth.status === "signed-in" ? auth.userId : null;
  const [saving, setSaving] = useState(false);
  // Which account was found to be the main one, so switching accounts hides the button again.
  const [mainAccount, setMainAccount] = useState<string | null>(null);
  const count =
    state.modules.length + state.notes.length + state.reminders.length + state.tasks.length + state.budgetCategories.length + state.budgetItems.length;

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void isMainAccount().then((yes) => {
      if (current && yes) setMainAccount(userId);
    });
    return () => {
      current = false;
    };
  }, [userId]);

  async function download() {
    setSaving(true);
    try {
      const current = new Date();
      const { name, text } = buildBackup(state, current, userId);
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

  async function downloadAll() {
    setSaving(true);
    try {
      const current = new Date();
      const accounts = await fetchAllAccounts();
      const { name, text } = buildFullBackup(accounts, current);
      if (await saveBackupFile(name, text)) {
        showMessage("Backup of every account saved", `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"} in ${name}`);
      }
    } catch {
      showMessage("Could not download every account", "Check your internet connection and try again.");
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
            : "Keep a copy of your account in a file"}
        </small>
      </div>
      <button className="theme-btn" type="button" disabled={saving || count === 0} onClick={download}>
        <Icon name="download" small />
        Download backup
      </button>
      {userId && mainAccount === userId && (
        <button className="theme-btn all-accounts" type="button" disabled={saving} onClick={downloadAll}>
          <Icon name="download" small />
          Download every account
        </button>
      )}
    </div>
  );
}
