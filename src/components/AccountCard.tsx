"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { turnOffNotifications } from "@/lib/push";
import { showMessage, signOutAndClear, unsyncedChanges } from "@/lib/store";

/** Who is signed in on this device, with a way to sign out. */
export function AccountCard({ notificationsOn }: { notificationsOn: boolean }) {
  const auth = useAuth();
  const [confirming, setConfirming] = useState(0);
  const [busy, setBusy] = useState(false);
  if (auth.status !== "signed-in") return null;

  async function signOut(force: boolean) {
    const waiting = unsyncedChanges();
    if (waiting > 0 && !force) {
      setConfirming(waiting);
      return;
    }
    setBusy(true);
    try {
      // Otherwise this device would keep getting the account's notifications after signing out.
      if (notificationsOn) await turnOffNotifications().catch(() => {});
      await signOutAndClear();
    } catch (error) {
      showMessage("Couldn't sign out", error instanceof Error ? error.message : "Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="backup account">
      <div>
        <b>Signed in</b>
        <small>{auth.email}</small>
      </div>
      {confirming > 0 ? (
        <div className="confirm">
          <p>
            {confirming} {confirming === 1 ? "change hasn't" : "changes haven't"} uploaded yet and will be lost. Connect to the internet
            first to keep {confirming === 1 ? "it" : "them"}.
          </p>
          <button className="danger solid" type="button" disabled={busy} onClick={() => signOut(true)}>
            Sign out anyway
          </button>
          <button className="ghost" type="button" onClick={() => setConfirming(0)}>
            Stay signed in
          </button>
        </div>
      ) : (
        <button className="theme-btn" type="button" disabled={busy} onClick={() => signOut(false)}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      )}
    </div>
  );
}
