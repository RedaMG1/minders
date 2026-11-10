"use client";

import Link from "next/link";
import { useState } from "react";
import { BackupButton } from "@/components/BackupButton";
import { Icon, ModuleIcon } from "@/components/Icon";
import { ModuleSheet } from "@/components/ModuleSheet";
import { TabBar } from "@/components/TabBar";
import { clock, dayKey, dayMonthLong, weekdayLong, whenLabel } from "@/lib/dates";
import {
  dismissInstallTip,
  tasksForToday,
  tasksForTomorrow,
  upcomingReminders,
  useApp,
  useSyncStatus,
} from "@/lib/store";

const COMING_UP_COUNT = 3;
const SYNC_MESSAGES = {
  saving: "Saving online…",
  saved: "All changes saved online",
  offline: "Saved on this device. It will upload when you're back online.",
};

function isIphoneBrowser() {
  const installed = window.matchMedia("(display-mode: standalone)").matches;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !installed;
}

export default function HomePage() {
  const app = useApp();
  const syncStatus = useSyncStatus();
  const [creating, setCreating] = useState(false);
  if (!app) return <div className="screen" />;

  const { state, now } = app;
  const today = tasksForToday(state.tasks, now);
  const tomorrow = tasksForTomorrow(state.tasks, now);
  const upcoming = upcomingReminders(state.reminders);
  const nextToday = upcoming.find((reminder) => dayKey(new Date(reminder.at)) === dayKey(now));
  const firstTomorrow = tomorrow.find((task) => task.first) ?? tomorrow[0];

  return (
    <div className="screen">
      <div className="status" />
      <div className="home-head">
        <div className="home-top">
          <p className="day-label">
            {weekdayLong(now)} {dayMonthLong(now)}
          </p>
          <div className="head-actions">
            <Link className="icon-btn" href="/search" aria-label="Search everything">
              <Icon name="search" />
            </Link>
            <Link className="theme-btn" href="/theme">
              <Icon name="palette" />
              Theme
            </Link>
          </div>
        </div>
        <h1 className="day-title">My modules</h1>
      </div>

      <div className="scroll home-body">
        {!state.installDismissed && isIphoneBrowser() && (
          <div className="install">
            <div>
              <b>Add Minders to your Home Screen</b>
              Tap Share in Safari, then Add to Home Screen.
            </div>
            <button className="row-btn" type="button" aria-label="Dismiss" onClick={dismissInstallTip}>
              <Icon name="x" />
            </button>
          </div>
        )}

        <div className="day-cards">
          <Link className="day-card sun" href="/today">
            <span>
              <Icon name="sun" small />
              Today
            </span>
            <strong>
              {today.filter((task) => task.done).length} of {today.length} done
            </strong>
            <small>{nextToday ? `Next at ${clock(new Date(nextToday.at))}` : "No more reminders"}</small>
          </Link>
          <Link className="day-card dark" href="/tomorrow">
            <span>
              <Icon name="moon" small />
              Tomorrow
            </span>
            <strong>
              {tomorrow.length} {tomorrow.length === 1 ? "task" : "tasks"}
            </strong>
            <small>{firstTomorrow ? firstTomorrow.title : "Nothing planned yet"}</small>
          </Link>
        </div>

        {state.modules.length === 0 && (
          <p className="empty">
            <b>Create your first module</b>
            Make one for each topic, like Work, Car or Ideas. Each one holds notes or reminders.
          </p>
        )}

        <div className="modules">
          {[...state.modules].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((module) => {
            const noteCount = state.notes.filter((note) => note.moduleId === module.id).length;
            const next = upcoming.find((reminder) => reminder.moduleId === module.id);
            return (
              <Link className={`module t-${module.color}`} href={`/module?id=${module.id}`} key={module.id}>
                <div className="module-row">
                  <span className="tile">
                    <ModuleIcon name={module.icon} />
                  </span>
                  <span className="kind">
                    <Icon name={module.type === "notes" ? "note" : "bell"} small />
                    {module.type === "notes" ? "Notes" : "Reminders"}
                  </span>
                </div>
                <h4>{module.name}</h4>
                {module.type === "notes" ? (
                  <p>
                    {noteCount} {noteCount === 1 ? "note" : "notes"}
                  </p>
                ) : next ? (
                  <p className="next">{whenLabel(new Date(next.at), now)}</p>
                ) : (
                  <p>Nothing coming up</p>
                )}
              </Link>
            );
          })}
          <button className="module add" type="button" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            New module
          </button>
        </div>

        {upcoming.length > 0 && (
          <div className="coming">
            <p className="section-label">Coming up</p>
            {upcoming.slice(0, COMING_UP_COUNT).map((reminder) => (
              <Link className="coming-row" href={`/module?id=${reminder.moduleId}`} key={reminder.id}>
                <span>
                  <b>{reminder.title}</b>
                  <small>{state.modules.find((module) => module.id === reminder.moduleId)?.name}</small>
                </span>
                <span className="at">{whenLabel(new Date(reminder.at), now)}</span>
              </Link>
            ))}
          </div>
        )}

        <BackupButton state={state} now={now} />

        {syncStatus !== "off" && (
          <p className="sync-status" role="status">
            {SYNC_MESSAGES[syncStatus]}
          </p>
        )}
      </div>

      <TabBar />
      {creating && <ModuleSheet onClose={() => setCreating(false)} />}
    </div>
  );
}
