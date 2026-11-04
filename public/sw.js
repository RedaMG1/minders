// Keeps the app working offline. Bump VERSION to drop the old caches after a change here.
const VERSION = "v2";
const CACHE = `minders-${VERSION}`;
const PAGES = ["/", "/today", "/tomorrow", "/reminders", "/theme", "/module", "/note", "/search"];
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
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
    const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const home = await caches.match("/");
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
