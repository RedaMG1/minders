import { dayKey } from "./dates";
import type { AppState } from "./types";

/** Bump this if the file layout changes, so an older backup can still be told apart. */
const BACKUP_VERSION = 1;

/** Everything worth keeping, as one readable file. Device-only settings like the theme are left out. */
export function buildBackup(state: AppState, now: Date) {
  const backup = {
    app: "Minders",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    modules: state.modules,
    notes: state.notes,
    reminders: state.reminders,
    tasks: state.tasks,
    budgetCategories: state.budgetCategories,
    budgetItems: state.budgetItems,
  };
  return {
    name: `minders-backup-${dayKey(now)}.json`,
    text: JSON.stringify(backup, null, 2),
  };
}

function isIphone() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Saves the backup on this device. On iPhone the Share sheet opens, with Save to Files;
 * everywhere else the file downloads. Returns false if the person closed the Share sheet.
 */
export async function saveBackupFile(name: string, text: string) {
  const file = new File([text], name, { type: "application/json" });

  if (isIphone() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      // Sharing failed for another reason, so fall back to a normal download.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
