# TTT-PWA1 — Phase 0 PWA verification report

Commit: `c184a6bc9a040f8033fdc9101f70b4eaacdbe8bf` on `main`
(parent `2810ca7`; slice base `5c544c7`).

## What shipped

- `public/manifest.webmanifest` — name/short_name/description, `id`/`start_url`/`scope` = `/`,
  `display: standalone`, icons 192/512 + maskable 512 + SVG any, theme/background `#f8fafb`
  (light token; dark is applied by `theme-init.js` at runtime).
- PNG icons generated from `public/favicon.svg` by `scripts/generate-pwa-icons.mjs`
  (`icon-192`, `icon-512`, `icon-maskable-512` with safe-zone padding, `apple-touch-icon`).
- `scripts/service-worker.js` + `pwaServiceWorker()` plugin in `vite.config.ts` — precaches
  every served URL; cache name is a SHA-256 of the file list so each deploy gets a fresh
  `ttt-shell-*` cache and activate deletes stale ones. Navigation network-first → precached
  `/index.html`; `/assets/*` cache-first; all off-origin traffic (matchmaking Worker https,
  wss relay) bypasses the worker.
- iOS meta in `index.html` (`apple-touch-icon`, `apple-mobile-web-app-capable`,
  `-title`, `-status-bar-style`); `/sw.js` and `/manifest.webmanifest` are `no-cache` in
  `public/_headers`.
- `src/lib/installPrompt.ts` + `src/lib/serviceWorker.ts`; `registerServiceWorker()` runs in
  `src/main.tsx` (production builds only, after `load`).
- "Install app" row in the Preferences sheet's App group, rendered only while a
  `beforeinstallprompt` offer is held; EN/ES strings added.

## Bug found and fixed during verification

First offline e2e run failed: the shell loaded but every `/assets/*` request died
`net::ERR_FAILED`. Root cause: preview host and Pages answer assets with `Vary: Origin`;
module scripts arrive cors-mode **with** an `Origin` header while `cache.addAll` stored
headerless requests, so `caches.match(request)` missed every chunk. Cache keys are now
rebuilt from URL pathname+search only (`cacheKey()`), which compares absent-to-absent and
matches regardless of request headers. Runtime `cache.put` uses the same canonical key, and
`freshOrCached` never writes unknown same-origin GETs into the cache.

## Verification evidence

- `pnpm lint` — clean.
- `pnpm build` + `pnpm deploy:check` — green (`dist/ looks ready`).
- `pnpm test` — 918 passed / 3 failed; all three are pre-existing CPU-timing AI suites
  (`src/game/ai.bench.test.ts` ×2, `src/game/game.property.test.ts` ×1) plus the `testEnv`
  meta-suite that re-runs them. Identical failures reproduced on a pristine checkout of the
  base commit (`~/Projects/tic-tac-toe` @ `7444e77`) — baseline-red on this machine, not a
  regression; this diff touches no `src/game` code.
- `pnpm test:e2e` — **42/42 passed** against the local `fuurma-matchmaking` Worker on
  `127.0.0.1:8787`, including the new `e2e/pwa-offline.spec.ts`
  ("app shell and a local game work offline", `context.setOffline(true)` → reload → lobby
  renders → vs-Computer move lands).
- Installability — headed (non-incognito) Chromium on the preview build: SW `activated` +
  `controlled`, manifest parses with no errors, `beforeinstallprompt` fires. Incognito
  contexts correctly get the `in-incognito` installability error and no row.
- Install affordance — phone 390×844 and desktop 1280×800: row "Install app" renders inside
  the Preferences sheet only after the offer, 56px tall (≥44px target), no horizontal
  overflow, zero console errors. Screenshots (gitignored `audits/`):
  `audits/pwa/install-row-390.png` (780×1688), `audits/pwa/install-row-desktop.png` (2560×1600).

## Not done / notes

- No deploy (Furma deploys). The Play TWA and later store phases remain open per
  `reports/mobile-stores-1116.md`.
- iOS has no `beforeinstallprompt`; install there is Share → Add to Home Screen (metadata
  shipped, no UI affordance by design).
- The `Vary: Origin` trap is worth remembering for any future runtime caching in this repo.
