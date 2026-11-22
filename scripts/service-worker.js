/* Tic Tac Toe Disappear — app-shell service worker.
 *
 * This file is the SOURCE, not the served worker: vite.config.ts reads it at
 * build time, substitutes the __PRECACHE_MANIFEST__ placeholder with the file
 * list of dist/, and writes the result to dist/sw.js. Read unprocessed it is
 * still valid JavaScript — an empty precache leaves the runtime strategies
 * below working. */

/* global self, caches, fetch, clients */

const PRECACHE = /*__PRECACHE_MANIFEST__*/ { cache: "ttt-shell-dev", urls: [] };

const PRECACHE_CACHE_PREFIX = "ttt-shell-";
const RUNTIME_CACHE = "ttt-runtime";
const NAVIGATION_FALLBACK = "/index.html";
const SKIP_WAITING_MESSAGE = "SKIP_WAITING";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE.cache)
      .then((cache) => cache.addAll(PRECACHE.urls)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) =>
                (name.startsWith(PRECACHE_CACHE_PREFIX) &&
                  name !== PRECACHE.cache) ||
                name === RUNTIME_CACHE,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      // Take over open pages immediately: every strategy below is safe for a
      // page loaded under the previous worker (HTML is network-first, hashed
      // assets are immutable), and waiting for a full close would stall the
      // update indefinitely inside an installed app.
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === SKIP_WAITING_MESSAGE) self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only this origin's static shell is ours to cache. The matchmaking Worker
  // (https + wss on another origin) and any future API pass straight through
  // — online play must never read a stale answer, and WebSockets never reach
  // a fetch handler anyway.
  if (url.origin !== self.location.origin) return;
  // The worker updates itself; caching it would pin the old shell forever.
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(navigation(request));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(assets(request));
  } else {
    event.respondWith(freshOrCached(request));
  }
});

/* Navigations are network-first and the cached copy is NEVER refreshed at
 * runtime: the precached index.html is the one whose hashed assets sit in the
 * same precache, so serving last-seen HTML would pair new markup with old
 * chunks — the stale-shell trap. A failed network falls back to that
 * consistent pair, which is what makes the app work offline. */
function navigation(request) {
  return fetch(request).catch(() =>
    caches
      .open(PRECACHE.cache)
      .then((cache) => cache.match(NAVIGATION_FALLBACK))
      .then((hit) => hit ?? Response.error()),
  );
}

/* Cache keys are rebuilt from the URL alone, never the fetch event's Request.
 * Responses served with `Vary: Origin` (the preview host and Pages both do)
 * only match a request whose Origin header equals the one stored at put time:
 * module scripts arrive cors-mode WITH an Origin header while addAll stored
 * headerless requests, so caches.match(request) silently missed every hashed
 * chunk and the offline shell died on its first script. A headerless key
 * compares absent-to-absent and matches every time. */
function cacheKey(request) {
  const url = new URL(request.url);
  return new Request(url.pathname + url.search, {
    credentials: "same-origin",
  });
}

/* /assets/* filenames carry a content hash, so a URL's bytes never change:
 * cache-first is always correct. A miss means the page asked for a chunk this
 * worker's precache does not know (a deploy newer than the worker, or a stale
 * page) — fetch it and keep it for the next ask. */
function assets(request) {
  const key = cacheKey(request);
  return caches.match(key).then((hit) => {
    if (hit) return hit;
    return fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches
            .open(RUNTIME_CACHE)
            .then((cache) => cache.put(key, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(key).then((retry) => retry ?? Response.error()),
      );
  });
}

/* Everything else same-origin is an unhashed public file (favicon, manifest,
 * theme-init, icons): fresh from the network while online, the install-time
 * precache copy when offline. Runtime puts stay out of this path so an
 * unrecognised same-origin GET can never be frozen into the cache. */
function freshOrCached(request) {
  return fetch(request).catch(() => caches.match(cacheKey(request)));
}
