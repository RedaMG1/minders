// Keeps the app working offline. Bump VERSION to drop the old caches after a change here.
const VERSION = "v6";
const CACHE = `minders-${VERSION}`;
const PAGES = ["/", "/today", "/tomorrow", "/reminders", "/theme", "/history", "/budget", "/budget/category", "/notifications", "/module", "/note", "/search"];
const FILES = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // One failed file should not stop the app from installing.
      Promise.allSettled([...PAGES, ...FILES].map((url) => cache.add(url))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Saved note photos live in their own cache and are kept across updates.
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== "minders-photos").map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Only this app version's cache is searched, never the note photos cache.
const fromCache = async (request, options) => (await caches.open(CACHE)).match(request, options);

async function cacheFirst(request) {
  const cached = await fromCache(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await fromCache(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const home = await fromCache("/");
      if (home) return home;
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.startsWith("/_next/static/") ? cacheFirst(request) : networkFirst(request));
});

// Shows a notification sent by the server, even when the app is closed.
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Minders", {
      body: message.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: message.tag,
      data: { url: message.url || "/" },
    }),
  );
});

// Tapping a notification opens the page it is about, reusing an open window if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (!open) return self.clients.openWindow(url);
      return open.focus().then((client) => client.navigate(url));
    }),
  );
});
