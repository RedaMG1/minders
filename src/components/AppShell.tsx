"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";
import { dismissToast, useApp, useToasts } from "@/lib/store";

export function AppShell({ children }: { children: ReactNode }) {
  const toasts = useToasts();
  const app = useApp();
  const theme = app?.state.theme;
  const brand = app?.state.brand;

  // Matches the phone's status bar to the page, so it stays readable in every theme.
  useEffect(() => {
    const screen = document.querySelector(".screen");
    if (screen) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", getComputedStyle(screen).backgroundColor);
  }, [theme, brand]);

  useEffect(() => {
    // In development the service worker would keep serving old files.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <>
      {children}
      {toasts.length > 0 && (
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <Icon name={toast.kind === "reminder" ? "bell" : "note"} />
              <div>
                <b>{toast.title}</b>
                {toast.detail && <small>{toast.detail}</small>}
              </div>
              <button className="row-btn" type="button" aria-label="Dismiss" onClick={() => dismissToast(toast.id)}>
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
