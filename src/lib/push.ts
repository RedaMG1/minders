import { getSupabase, notificationsUrl, publishableKey } from "./sync";
import type { NotificationSettings } from "./types";

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: false,
  digestEnabled: true,
  digestTime: "08:00",
  remindersEnabled: true,
};

export type PushSupport = "ready" | "needs-install" | "unsupported" | "no-server";

/** Whether this device can get notifications, and if not, why. */
export function pushSupport(): PushSupport {
  if (!notificationsUrl) return "no-server";
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installed =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPhone only allows notifications for apps added to the Home Screen.
  if (iphone && !installed) return "needs-install";
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return capable ? "ready" : "unsupported";
}

export const notificationPermission = () => ("Notification" in window ? Notification.permission : "default");

function keyBytes(base64Url: string) {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function registration() {
  // The app registers this file itself in production; this also covers development builds.
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

async function callServer(body?: object) {
  const response = await fetch(notificationsUrl!, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", apikey: publishableKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 404 && !result.error) throw new Error("Notifications aren't set up on the server yet.");
  if (!response.ok) throw new Error(result.error ?? "The notifications server didn't answer.");
  return result;
}

async function saveOnServer(subscription: PushSubscription, settings: NotificationSettings) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("This version of the app has no database settings.");
  const { error } = await supabase.rpc("save_push_subscription", {
    p_subscription: subscription.toJSON(),
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_digest_time: settings.digestTime,
    p_digest_enabled: settings.digestEnabled,
    p_reminders_enabled: settings.remindersEnabled,
  });
  if (error) throw new Error("Couldn't save your notification settings. Check your internet connection.");
}

/** Asks for permission, signs this device up and saves its settings. Call it straight from a tap. */
export async function turnOnNotifications(settings: NotificationSettings) {
  // iPhone only shows the permission question when it comes straight from a tap, so ask first.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications weren't allowed. You can allow them in your phone or browser settings.");
  }
  const worker = await registration();
  await navigator.serviceWorker.ready;
  const { publicKey } = await callServer();
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await saveOnServer(subscription, settings);
}

export async function updateNotificationSettings(settings: NotificationSettings) {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) throw new Error("This device isn't signed up anymore. Turn notifications on again.");
  await saveOnServer(subscription, settings);
}

export async function turnOffNotifications() {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) return;
  await getSupabase()?.rpc("remove_push_subscription", { p_endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export async function sendTestNotification() {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) throw new Error("This device isn't signed up anymore. Turn notifications on again.");
  await callServer({ action: "test", endpoint: subscription.endpoint });
}
