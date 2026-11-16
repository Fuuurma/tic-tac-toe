# Mobile stores research — tic-tac-toe & gambit-deck → Google Play / App Store

**Slice:** TTT-MOBILE-STORES-RESEARCH1 · **Date:** 2026-11-16 · **Status:** research only, no code changed
**Repos:** `Fuuurma/tic-tac-toe` @ `7444e77`, `~/Projects/gambit-deck` @ `c329dd0` — both Vite + React 19 + TS, Cloudflare Pages, online play via the shared `fuurma-matchmaking` Cloudflare Worker (WebSocket relay, `VITE_MATCHMAKING_URL`).

---

## TL;DR — recommended path

**Phase 0 (now, ~free): make both sites installable PWAs.** gambit-deck already ships `manifest.json` + apple-touch-icon; tic-tac-toe needs a manifest + icons (+ optionally a small service worker). This unlocks "Add to Home Screen" on iOS and the install prompt on Android Chrome, plus Web Push (Android everywhere; iOS 16.4+ for installed apps) and `navigator.vibrate` haptics on Android — with zero store review.

**Phase 1 (Play only, ~$25 + a 14-day gate): ship both apps as TWAs via Bubblewrap.** Google's own sanctioned wrapper for "the app is the website": it renders the live Pages site fullscreen in Chrome, verified by Digital Asset Links. WebSocket play, localStorage, Web Audio SFX, safe areas and vibration all keep working because it *is* the site. Web updates ship instantly — no review per deploy.

**Phase 2 (only if iOS store presence is worth it): Capacitor wrapper with deliberate native additions** — push via `@capacitor/push-notifications` (FCM/APNs), haptics via `@capacitor/haptics`, native splash/icons — to clear App Review Guideline 4.2 ("repackaged website"). Keep the web app bundled and add OTA updates (Capacitor Live Updates via Appflow, or Capawesome/Capgo/self-hosted) so web fixes don't need a store release.

**Do not rewrite in React Native/Expo.** Both games' value is the existing React DOM UI; a rewrite is weeks of work per repo for marginal gain at this stage. Revisit only if mobile becomes the primary platform.

---

## Current state of the two repos (verified 2026-11-16)

| Surface | tic-tac-toe | gambit-deck |
|---|---|---|
| Web app manifest | **none** | `public/manifest.json` — `display: standalone`, 192/512 + maskable icons, `start_url`, theme colours |
| apple-touch-icon / iOS meta | none | `apple-touch-icon.png`, `apple-mobile-web-app-capable`, `black-translucent` status bar |
| Service worker | **none** | **none** |
| Installable today? | No (no manifest) | Manifest yes; SW absent — Chrome install-from-menu no longer requires a SW fetch handler (Chrome 108 mobile / 112 desktop, [blog](https://developer.chrome.com/blog/update-install-criteria)), so install likely works; offline does not |
| Online play | `@fuurma/online-client` (GitHub pkg) → `wss://fuurma-matchmaking…workers.dev` via `VITE_MATCHMAKING_URL` | own `src/lib/transportWS.ts` → same worker |
| CSP | `public/_headers` already allows `connect-src` to the worker (https + wss) | meta-CSP + `_headers` same allowance |
| Storage | `localStorage` only (`src/lib/storage.ts` guard): guestId, displayName, stats, prefs, i18n | `localStorage` (Zustand persist + `cc-theme` etc.) |
| Accounts / auth | none — guest-only | none — guest-only |
| Audio | none | Web Audio synthesized SFX (`src/lib/sounds.ts`, `AudioContext`) |
| Safe areas | `viewport-fit=cover` + `env(safe-area-inset-*)` vars in `index.css` | same pattern (`viewport-fit=cover`, safe-area CSS) |
| Haptics | none | none |
| Push | none | none |
| Analytics/tracking | none found | none found |
| Privacy policy page | **none** | **none** |

Neither repo collects accounts or runs third-party analytics — the privacy story is small: a guest-chosen display name shared with opponents inside rooms, plus on-device stats/preferences. A short static privacy page on Pages covers both store requirements.

---

## Path comparison

### 1. Installable PWA (both platforms, no store)

- **Effort:** tic-tac-toe ~0.5–1 day (manifest, PNG icons 192/512/maskable, optional `vite-plugin-pwa` or hand-rolled SW); gambit-deck ~0.5 day (add SW + verify manifest; `display: standalone` already set). One shared pattern, two small diffs.
- **What breaks:** nothing — it is the same site. HTTPS already provided by Cloudflare Pages.
- **Installability:** Chrome criteria = manifest with `name`/`short_name`, 192+512 icons, `start_url`, `display: standalone|fullscreen|minimal-ui`, served over HTTPS ([web.dev install criteria](https://web.dev/articles/install-criteria), checked 2026-11-16). SW fetch handler no longer required for install since Chrome 108/112 ([Chrome blog](https://developer.chrome.com/blog/update-install-criteria)). iOS has no install prompt API: users use Share → Add to Home Screen; `apple-mobile-web-app-capable` + apple-touch-icon make it open standalone.
- **Offline:** only with a service worker + cache strategy (optional; online play needs network anyway — local vs AI could be made offline-capable cheaply).
- **Push:** Web Push works on Android Chrome (incl. installed PWA); on iOS/iPadOS 16.4+ for Home-Screen-installed web apps via Push API + Notifications API + SW on Apple's push service — **no Apple Developer account needed** ([WebKit blog, 2023-02-16](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).
- **Haptics:** `navigator.vibrate()` works on Android (Chromium only); **never on iOS** — WebKit formally opposes the Vibration API and has never shipped it ([W3C implementation report](https://w3c.github.io/vibration/reports/implementation.html), [caniuse](https://caniuse.com/vibration), checked 2026-11-16).
- **Updates:** instant — every Pages deploy is live for installed apps.
- **Store presence:** none. This is the baseline everything else builds on, and it is the only path with zero review and zero fees.

### 2. TWA via Bubblewrap (Google Play only)

- **Effort:** low per repo. `bubblewrap init --manifest https://<pages-domain>/manifest.json` generates an Android project; host `.well-known/assetlinks.json` on the domain listing the app's signing fingerprint; build AAB; upload to Play. PWA Builder offers a GUI alternative ([Chrome TWA quick-start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start), checked 2026-11-16). ~1–3 days per repo including Play Console listing assets.
- **What it is:** a thin native shell that opens your HTTPS origin fullscreen in the user's browser engine, verified as yours via Digital Asset Links ([TWA overview](https://developer.chrome.com/docs/android/trusted-web-activity/)). It is *not* a WebView wrapper in the policy sense — it is Google's own answer to "publish my PWA to Play".
- **What breaks:** nothing technical. WebSocket (`wss://…workers.dev`), localStorage, IndexedDB, Web Audio, `env(safe-area-inset-*)`, vibration, and Web Push all behave exactly as in Chrome — the TWA *is* the browser rendering your origin. Requires the manifest (Phase 0 prerequisite) and a service worker for push/offline.
- **Play policy fit:** Play's "Webviews and Affiliate Spam" rule bans webviews of sites *without the owner's permission* and bare-traffic apps ([Play Spam policy](https://support.google.com/googleplay/android-developer/answer/9899034), checked 2026-11-16). A TWA of your own domain is the sanctioned exception; Play still applies core-quality bars (crashes/ANRs, target API level — **API 36 / Android 16 required for new apps since 2026-08-31**, [Play target API](https://support.google.com/googleplay/android-developer/answer/11926878)). Bubblewrap's current templates track recent AGP/SDK levels; verify before first upload.
- **Push:** standard Web Push through the service worker; in a verified TWA, `PushManager.subscribe` can auto-grant without a prompt ([Bubblewrap issue #660, Chrome team](https://github.com/GoogleChromeLabs/bubblewrap/issues/660)).
- **Haptics:** `navigator.vibrate` works (Chromium underneath).
- **Updates:** web changes ship with the next Pages deploy — **no store review**. Only shell/tooling changes need a Play release.
- **Limitations:** Android only — contributes nothing to iOS. App is as thin as the site: no native-only capabilities beyond what Chrome exposes (no widgets, no native share sheet beyond Web Share API, no background fetch guarantees beyond SW).
- **iOS 4.2 analog:** N/A — this path never touches Apple.

### 3. Capacitor (both stores)

- **Effort:** medium per repo. Add `@capacitor/core` + platform packages, `npx cap init`, `cap add ios` / `cap add android`, `cap sync`, wire plugins. The apps' pure logic (`src/game/`, `src/lib/room-protocol/`, wire schemas) is React-free or thin-React and ports untouched; **all UI is React DOM + Tailwind and runs as-is inside the WebView** — that is the point and also the risk. Estimate 3–7 days per repo to first store submission, plus review cycles.
- **Architecture choice that matters:**
  - *Bundled web assets* (default): app is self-contained, works offline for shell, updates need store release **or** an OTA live-update layer — official route is Ionic Appflow Live Updates ([Capacitor deploying/updating docs](https://capacitorjs.com/docs/guides/deploying-updates)); community options Capawesome Live Update / Capgo exist. Apple and Google explicitly permit web-content updates.
  - *`server.url` pointing at the live Pages site*: instant updates, but the binary is then literally a WebView of your website — maximum 4.2 exposure and no offline. Not recommended.
- **What breaks / needs work:**
  - **CSP:** gambit-deck's CSP already whitelists the matchmaking `wss://` origin — bundled origin becomes `capacitor://localhost` (iOS) / `https://localhost` (Android); `connect-src` stays valid since the worker origin is absolute. tic-tac-toe's `_headers` CSP likewise already allows it. Verify `img-src`/`font-src`/`style-src` cover bundled assets (`'self'` does).
  - **Storage:** `localStorage` works in WKWebView/Android WebView and persists per-app; survives app updates, cleared on uninstall. For durability guarantees use `@capacitor/preferences` (native-backed).
  - **Audio:** Web Audio `AudioContext` works but iOS WKWebView requires a user gesture to start (already true for game SFX) and may need `mediaPlaybackRequiresUserAction` config — Capacitor exposes this.
  - **Safe areas:** `env(safe-area-inset-*)` resolves correctly once the WebView is edge-to-edge; Capacitor also ships a SafeArea plugin. Both repos already consume the env vars.
  - **WebSocket:** `wss://` to the Worker works in both WebViews; keepalive/background behaviour is *worse* than a browser tab (OS may suspend) — same as any mobile app; room protocol already has reconnect logic.
  - **Offline:** bundled assets fine; online play still needs network (unchanged).
- **Push:** `@capacitor/push-notifications` — FCM on Android (needs a Firebase project + `google-services.json`), APNs on iOS (needs the Push Notifications capability + Apple credentials). Real native push both sides — better than web push (works with app killed, badges, channels).
- **Haptics:** `@capacitor/haptics` — UIImpactFeedback on iOS, Vibrator on Android. This is the only path that gives iOS haptics.
- **App Store Guideline 4.2 risk — the central issue.** Guideline 4.2 (Minimum Functionality): *"Your app should include features, content, and UI that elevate it beyond a repackaged website"* ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), checked 2026-11-16). A Capacitor shell around the existing site is the textbook 4.2 rejection profile — Apple rejects bare WebView wrappers regularly. **How to pass:**
  1. Ship real native additions, not just the wrapper: push notifications (turn alerts), haptics on moves, native share sheet for invite links, maybe a widget later. Each plugin is a legitimate native capability.
  2. Follow the HIG where the web UI diverges (navigation patterns, typography, dark mode already present).
  3. Do **not** use `server.url` live-reload in production.
  4. Fill App Review notes explaining the native integrations; provide a demo account if needed (guest play needs none).
  5. Budget for one rejection cycle — 4.2 outcomes are reviewer-discretion; resubmission with added native features usually passes.
  - Guideline 4.7 (mini apps/HTML5) applies only to *downloaded* JS content, not bundled assets — bundling keeps you out of its stricter regime.
- **Google Play fit:** allowed — Play's WebView rule targets sites *without owner permission*; you own the site. Still needs "basic degree of adequate utility as mobile apps" ([Functionality policy](https://support.google.com/googleplay/android-developer/answer/9898783)) — native plugins help here too.
- **Updates:** store release per binary change; OTA live-update for web-layer changes (adds a dependency/ops surface — Capawesome/Capgo or Appflow).
- **Tooling:** iOS builds need macOS + Xcode (Furma's machine qualifies) or a paid CI (Appflow/Codemagic/Bitrise). Android builds need JDK + Android SDK (or cloud CI).

### 4. React Native / Expo rewrite

- **Effort:** high — every screen is a React DOM + Tailwind component; RN needs a new UI layer (RN primitives or NativeWind). Salvageable: `src/game/` rules/AI (pure TS), room-protocol state machine, wire schemas, i18n strings. Not salvageable: all rendering, gestures (`@use-gesture` in gambit-deck), animations (`motion`, thinking-orbs), canvas background field. Estimate weeks per repo, then permanent dual-stack or full migration cost.
- **What breaks:** everything visual is rewritten; behaviour must be re-verified (807 vitest tests in ttt are DOM-coupled).
- **4.2 risk:** lowest — it is a genuine native app.
- **Push/haptics:** best-in-class (`expo-notifications`, `expo-haptics`).
- **Updates:** EAS Update OTA is built-in and free-tier friendly.
- **Verdict:** unjustified for two casual games whose differentiator is the existing web UI. Revisit only if a native-only feature (widgets, Game Center, Apple Watch) becomes a product requirement.

---

## Store costs & rules (official sources, checked 2026-11-16)

| Item | Apple App Store | Google Play |
|---|---|---|
| Account fee | **US$99/year**, billed in local currency — ≈ **€98.99–99/yr** in the EU ([program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/): "99 USD … in local currency where available"; EU App Store price €98.99) | **US$25 one-time** registration ([Play Console signup](https://support.google.com/googleplay/android-developer/answer/6112435)) |
| Org account extra | Legal entity + **D-U-N-S number** (free from Dun & Bradstreet, up to 5 business days), work email on company domain, public website ([D-U-N-S help](https://developer.apple.com/help/account/membership/D-U-N-S/), [enrollment](https://developer.apple.com/programs/enroll/)) | Organization account: D-U-N-S + business verification documents; **personal** account: government ID + card in legal name, Play Console app device-verification ([signup steps 5–6](https://support.google.com/googleplay/android-developer/answer/6112435)) |
| New-developer testing gate | none (TestFlight optional, up to 10k external testers) | **Personal accounts created after 2023-11-13: closed test with ≥12 testers opted in continuously ≥14 days** before production access application ([Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)) |
| EU/UK trader status (DSA) | Must declare trader status at next app submission even if not distributing in EU; traders publish address + phone + email on EU product pages, verified with documents; apps without status were removed from EU storefront 2025-02-18 ([Apple DSA help](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements), [Apple News 2025-02-18](https://developer.apple.com/news/?id=6agg0lja)) | All active accounts must declare trader/non-trader for EEA+UK **by 2027-02-01**; traders show business contact info ([Play trader declaration](https://support.google.com/googleplay/android-developer/answer/17594752)) |
| Age rating | New system since **2026-01-31**: 4+/9+/13+/16+/18+, mandatory questionnaire incl. in-app controls, capabilities, medical/wellness, violent themes ([Apple news 2025-07-24](https://developer.apple.com/news/?id=ks775ehf), [upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)). Expect **4+** for both games | Mandatory **IARC questionnaire** → regional ratings (PEGI/ESRL/etc.) generated immediately; "interactive features" (user-to-user communication) disclosed separately ([Play content ratings](https://support.google.com/googleplay/android-developer/answer/9898843), [IARC FAQ](https://globalratings.iarcservices.com/faq/)). Expect Everyone/E10+ |
| Privacy policy | **Privacy Policy URL required** in App Store Connect for iOS apps + privacy nutrition label ([App privacy help](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/), [app information reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)) | Privacy policy required in store listing **and inside the app**; Data safety form in Play Console; account-deletion flow required **only if accounts exist** — both apps are guest-only ([Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311), [target audience setup](https://support.google.com/googleplay/android-developer/answer/9867159)) |
| Content rules | Guideline **4.2** "repackaged website" bar; 4.7 mini-app rules for downloaded JS; Sign in with Apple only if third-party login offered (N/A — guest-only) ([guidelines](https://developer.apple.com/app-store/review/guidelines/)) | WebView-spam rule (own-site TWA/capacitor OK, bare unlicensed webview not); minimum-functionality bar; target API 36 since 2026-08-31 ([Spam policy](https://support.google.com/googleplay/android-developer/answer/9899034), [Functionality](https://support.google.com/googleplay/android-developer/answer/9898783), [target API](https://support.google.com/googleplay/android-developer/answer/11926878)) |
| Review time | typically ~24–48 h, can be longer for first submissions | varies; new personal accounts should expect longer first reviews |

**Indicative money cost to reach both stores:** Apple €99/yr + Play $25 once ≈ **~€120 first year**, then €99/yr. PWA/TWA phases need only the Play fee; the Apple fee is only spent if Phase 2 (Capacitor) proceeds.

---

## Phased plan

**Phase 0 — installable PWAs (both repos, days, $0)**
1. tic-tac-toe: add `manifest.webmanifest` (name, short_name, 192/512/maskable icons, `start_url`, `display: standalone`, theme colours), PNG icon set, `<link rel="manifest">` + apple-touch-icon + iOS meta tags (copy gambit-deck's pattern). Optionally a minimal service worker (precaching app shell) via `vite-plugin-pwa` or ~50 lines by hand — needed anyway for Web Push and TWA push.
2. gambit-deck: add the same service worker; manifest/icons already present.
3. Add a `/privacy` page to both sites (guestId/displayName/stats explanation, no tracking, contact email) — required by every store path later and good practice now.
4. Optional: Web Push subscription UI (turn notifications for online games) — works on Android Chrome + installed iOS PWAs today.

**Phase 1 — Google Play via TWA (weeks incl. the 14-day tester gate, $25)**
1. Furma creates Play Console account (personal or org — see decisions).
2. `bubblewrap init` per repo against the production manifest; generate icons/splash; build signed AAB (Play App Signing).
3. Host `.well-known/assetlinks.json` on each Pages domain with the Play app-signing cert fingerprint.
4. Play listing: descriptions, icon, feature graphic, IARC questionnaire, Data safety form, privacy policy URL, content rating.
5. **Personal accounts:** run the closed test — recruit ≥12 testers for ≥14 continuous days, then apply for production.
6. Submit; typical first-review wait applies.

**Phase 2 — Apple App Store via Capacitor (only if wanted, $99/yr + review risk)**
1. Furma enrolls in Apple Developer Program (individual vs org decision).
2. Per repo: `cap add ios`, plugins (push-notifications, haptics, preferences, safe-area, keyboard, status-bar), app icons/splash via `@capacitor/assets`, native config polish.
3. Add the native-feel features that carry 4.2: haptics on piece placement/capture, push for turn/rematch, share sheet for room links.
4. App Store Connect: privacy policy URL, privacy nutrition labels, age-rating questionnaire (expect 4+), EU trader declaration, screenshots per device class, review notes.
5. Submit via Xcode/Transporter; budget one 4.2 rejection cycle.
6. OTA update pipeline decision (Appflow vs Capawesome/Capgo vs store-release-only).

**Explicitly deferred:** React Native/Expo rewrite; native widgets/Game Center; paid features/IAP (would change ratings, trader status and privacy answers — none of these apps monetise today).

---

## Decisions only Furma can take

1. **Apple Developer Program enrollment** — individual (~€99/yr, seller = his legal name) vs organization (needs a legal entity + D-U-N-S + company-domain email + public website; seller = company name). *Blocks Phase 2 only.*
2. **Google Play account type** — personal ($25, then the 12-tester/14-day closed-test gate) vs organization (D-U-N-S + verification docs, no tester gate). *Blocks Phase 1.*
3. **Pay the fees** — $25 Play (Phase 1) and/or ~€99/yr Apple (Phase 2). PWA phase is free.
4. **Identity verification** — government ID + legal name on both stores; Apple org additionally needs D-U-N-S and binding authority.
5. **EU trader status** — declare trader (publishes address/phone/email on EU store pages, needs verification docs) or non-trader. These are free apps with no ads/IAP, so non-trader is plausible, but it is Furma's legal call per DSA.
6. **iOS strategy** — accept that iOS users get the installable PWA (Add to Home Screen, push on 16.4+, no haptics) and skip the App Store entirely, or fund Phase 2. This is the biggest scope decision in the report.
7. **Privacy policy content** — confirm the data statement (display name + gameplay events visible to opponents; on-device stats; no accounts, no analytics, no tracking) and the contact address to publish.
8. **Closed-test recruitment (if personal Play account)** — 12 real people opted in for 14 days; only Furma can supply them.
9. **OTA updates for Capacitor (if Phase 2)** — Appflow (paid, official) vs Capawesome/Capgo community plugin vs store-release-only.

---

## Sources (all checked 2026-11-16)

- Apple Developer Program fee & enrollment: https://developer.apple.com/programs/ , https://developer.apple.com/help/account/membership/program-enrollment/ , https://developer.apple.com/help/account/membership/D-U-N-S/ , https://developer.apple.com/programs/enroll/
- Apple EU DSA trader: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements , https://developer.apple.com/news/?id=6agg0lja
- Apple age ratings: https://developer.apple.com/news/?id=ks775ehf , https://developer.apple.com/news/upcoming-requirements/
- Apple privacy policy requirement: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/ , https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/
- App Review Guidelines (4.2, 4.7): https://developer.apple.com/app-store/review/guidelines/
- Google Play signup/fee/identity: https://support.google.com/googleplay/android-developer/answer/6112435
- Play personal-account testing gate: https://support.google.com/googleplay/android-developer/answer/14151465
- Play EU/UK trader declaration: https://support.google.com/googleplay/android-developer/answer/17594752
- Play content ratings (IARC): https://support.google.com/googleplay/android-developer/answer/9898843 , https://globalratings.iarcservices.com/faq/
- Play User Data / privacy / target audience: https://support.google.com/googleplay/android-developer/answer/10144311 , https://support.google.com/googleplay/android-developer/answer/9867159
- Play Spam/WebView + Functionality + target API: https://support.google.com/googleplay/android-developer/answer/9899034 , https://support.google.com/googleplay/android-developer/answer/9898783 , https://support.google.com/googleplay/android-developer/answer/11926878 , https://developer.android.com/google/play/requirements/target-sdk
- PWA installability: https://web.dev/articles/install-criteria , https://developer.chrome.com/blog/update-install-criteria , https://web.dev/learn/pwa/web-app-manifest
- iOS Web Push for Home Screen web apps: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- TWA: https://developer.chrome.com/docs/android/trusted-web-activity/ , https://developer.chrome.com/docs/android/trusted-web-activity/quick-start , https://github.com/GoogleChromeLabs/bubblewrap/issues/660
- Capacitor: https://capacitorjs.com/docs , https://capacitorjs.com/docs/apis/push-notifications , https://capacitorjs.com/docs/guides/deploying-updates
- Vibration API support: https://w3c.github.io/vibration/reports/implementation.html , https://caniuse.com/vibration , https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
