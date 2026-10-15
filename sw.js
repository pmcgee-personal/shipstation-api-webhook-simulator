// Service worker for the ShipStation API Webhook Simulator (PWA).
//
// Strategy: network first, cache as the offline fallback. Whenever the page is
// online it always loads the latest files, so updated payloads show up right
// away. The cache only matters when there is no connection.
//
// Bump CACHE_NAME whenever the list of files below changes. Old caches are
// deleted when the new worker activates.
const CACHE_NAME = "ss-sim-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./fixtures.js",
  "./replay.js",
  "./manifest.json",
  "./icon.png",
];

// Install: save the app files, and take over without waiting for old tabs.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: delete caches from older versions, then start controlling pages.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: only handle GET requests for this app's own files. Webhook POSTs,
// the proxy and the CDN script are left to the browser.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || caches.match("./index.html")),
      ),
  );
});
