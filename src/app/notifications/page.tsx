"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { TabBar } from "@/components/TabBar";
import {
  DEFAULT_NOTIFICATIONS,
  notificationPermission,
  pushSupport,
  sendTestNotification,
  turnOffNotifications,
  turnOnNotifications,
  updateNotificationSettings,
} from "@/lib/push";
import { setNotificationSettings, showMessage, useApp } from "@/lib/store";
import type { NotificationSettings } from "@/lib/types";

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");

function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export default function NotificationsPage() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!app) return <div className="screen" />;

  const settings = app.state.notifications ?? DEFAULT_NOTIFICATIONS;
  const support = pushSupport();
  const blocked = support === "ready" && notificationPermission() === "denied";
  const on = settings.enabled && support === "ready" && !blocked;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (problem) {
      setError(message(problem));
    } finally {
      setBusy(false);
    }
  }

  const change = (next: Partial<NotificationSettings>) =>
    run(async () => {
      const updated = { ...settings, ...next };
      await updateNotificationSettings(updated);
      setNotificationSettings(updated);
    });

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
        <h1 className="day-title">Notifications</h1>
      </div>

      <div className="scroll color-body">
        {support === "no-server" && (
          <Explainer title="Not available here">This version of the app isn&apos;t connected to the online database.</Explainer>
        )}
        {support === "needs-install" && (
          <Explainer title="Add Minders to your Home Screen first">
            iPhone only sends notifications to apps on the Home Screen. In Safari, tap Share, then Add to Home Screen. Open Minders
            from its new icon and come back to this page.
          </Explainer>
        )}
        {support === "unsupported" && (
          <Explainer title="This browser can't show notifications">Try Chrome, Edge, Firefox or Safari on a recent version.</Explainer>
        )}
        {blocked && (
          <Explainer title="Notifications are blocked">
            Allow them for Minders in your settings: on iPhone, Settings, then Notifications, then Minders. In a browser, use the
            site settings next to the address.
          </Explainer>
        )}

        {support === "ready" && !blocked && !on && (
          <div className="notify-intro">
            <p>Get your day&apos;s tasks each morning, and your reminders at their time, even when Minders is closed.</p>
            <button
              className="primary"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const next = { ...settings, enabled: true };
                  await turnOnNotifications(next);
                  setNotificationSettings(next);
                  showMessage("Notifications are on");
                })
              }
            >
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          </div>
        )}

        {on && (
          <>
            <div className="setting-list">
              <label className="setting">
                <span>
                  <b>Morning summary</b>
                  <small>Your tasks for the day, including unfinished ones</small>
                </span>
                <input
                  className="switch"
                  type="checkbox"
                  id="digest-enabled"
                  checked={settings.digestEnabled}
                  disabled={busy}
                  onChange={(event) => change({ digestEnabled: event.target.checked })}
                />
              </label>
              {settings.digestEnabled && (
                <label className="setting">
                  <span>
                    <b>Time</b>
                    <small>Skipped on days with nothing to do</small>
                  </span>
                  <input
                    className="time-field"
                    type="time"
                    id="digest-time"
                    value={settings.digestTime}
                    disabled={busy}
                    onChange={(event) => {
                      if (/^\d{2}:\d{2}$/.test(event.target.value)) change({ digestTime: event.target.value });
                    }}
                  />
                </label>
              )}
              <label className="setting">
                <span>
                  <b>Reminders</b>
                  <small>Each reminder at its time</small>
                </span>
                <input
                  className="switch"
                  type="checkbox"
                  id="reminders-enabled"
                  checked={settings.remindersEnabled}
                  disabled={busy}
                  onChange={(event) => change({ remindersEnabled: event.target.checked })}
                />
              </label>
            </div>

            <button
              className="primary"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await sendTestNotification();
                  showMessage("Test sent", "It should arrive in a few seconds.");
                })
              }
            >
              Send a test notification
            </button>
            <button
              className="danger"
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await turnOffNotifications();
                  setNotificationSettings({ ...settings, enabled: false });
                  showMessage("Notifications are off");
                })
              }
            >
              Turn off notifications
            </button>
            <p className="color-note">These settings are for this device only. Turn notifications on separately on each phone or computer.</p>
          </>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <TabBar />
    </div>
  );
}
