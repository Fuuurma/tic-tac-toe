# UX audit — launch readiness (TTT-UX-AUDIT1)

**Date:** 2026-11-16 · **Commit:** `7444e77` (`refactor(ui): split LobbyForm into hooks + section components`) · **App:** `pnpm dev` on `127.0.0.1:3110` + real local matchmaking Worker (`workerd`, `127.0.0.1:8787`)

**Method.** 166 screenshots at 390×844 (touch) and 1440×900, light + dark, driven by Playwright/Chromium against the real app — including two-browser-context online games over the real Worker (quick-match pair, room create/join, warm-up, connected host/guest). Automated layout + accessibility instrumentation measured every state: horizontal overflow, sub-12px text, sub-44px touch targets, unlabeled controls, and axe-core (incl. color-contrast). Reduced-motion and keyboard traversal were emulated and measured. `DESIGN.md` was treated as the hard contract; `ui-craft`, `ui-self-review`, `ui-responsive`, `ui-accessibility` as the rubric.

**Verdict.** No P0s. The app is in strong shape for launch: zero console errors in product flows, no horizontal overflow anywhere, no unlabeled controls, axe is clean except two moderate/serious items, reduced-motion is honored (0 running animations under `prefers-reduced-motion`), the board is fully keyboard-operable, focus-visible rings are consistent, and every requested screen/state was captured except the impossible draw (see Notes). The findings below are first-run friction and polish, not breakage.

## Coverage

| Surface | phone-light | phone-dark | desktop-light | desktop-dark |
|---|---|---|---|---|
| Onboarding (welcome→profile→practice→ready) | ✔ | n/a* | ✔ | n/a* |
| Lobby default / vs Friend / vs Computer | ✔ | ✔ | ✔ | ✔ |
| Players sheets (you/opponent/difficulty) | ✔ | ✔ | ✔ | ✔ |
| Settings, Help/tutorial | ✔ | ✔ | ✔ | ✔ |
| Online lobby (quick/create/join), invite landing | ✔ | ✔ | ✔ | ✔ |
| Quick-match search, warm-up, handoff | ✔ | ✔ | ✔ | ✔ |
| Connected online game (host + guest) | ✔ | ✔ | ✔ | ✔ |
| Room ready / warm-up / connected / bad room | ✔ | ✔ | ✔ | ✔ |
| Online error / service down | ✔ | ✔ | ✔ | ✔ |
| Local game mid, vs-computer easy/normal/hard | ✔ | ✔ | ✔ | ✔ |
| Game over: win, lose | ✔ | ✔ | ✔ | ✔ |
| In-game sheets: settings, help, players-edit, record breakdown, confirms | ✔ | ✔ | ✔ | ✔ |

\* Onboarding is unreachable in dark: theme selection lives in Settings, which requires completing onboarding, and nothing in the flow reads `prefers-color-scheme` (see F4).

Measurement detail: `reports/ux-audit-1116/audit/results.json` · shot index: `reports/ux-audit-1116/manifest.json` (166/166 ok).

## Findings

### P0 — none

Nothing found that blocks or breaks a first-time player. All core flows complete; the worst automated hits are one serious and one moderate axe rule (F5, F6).

### P1

**F1 — Friend-room codes are 36-character UUIDs; the "send this code" path is unusable.**
- Evidence: `reports/ux-audit-1116/online-room-ready-phone-light.png`, `online-room-ready-desktop-light.png`
- Rule/impact: share/invite flow must be low-friction (ui-craft; the task's share-flow criterion). `generateRoomId()` returns `crypto.randomUUID()` (`src/lib/roomId.ts`), so "Copy code" yields e.g. `01dbb11a-a34f-44d2-9105-15a0af397970` — impossible to read aloud, dictate, or type. `ROOM_ID_PATTERN` already accepts 4–64 chars of `[a-zA-Z0-9_-]`, so short codes are protocol-legal; only the generator never makes them. For a game launching via social announcement, invites are the growth loop and this is its weakest link. The invite *link* mitigates but fails for anyone sharing verbally or in apps that strip URLs.
- Proposed change: generate short friend-room codes (e.g. 6 chars from an unambiguous alphabet, retry on collision — the relay already rejects duplicates with "room code already in use"). Keep UUIDs for quick-match internals where nobody reads them.

**F2 — Phone sheets hide the only labeled way out.**
- Evidence: `reports/ux-audit-1116/lobby-settings-phone-light.png`, `lobby-players-opponent-phone-light.png`, `game-help-phone-light.png`
- Rule/impact: DESIGN.md sanctions swipe-down dismissal ("Forms are pages… swipe-down on its header dismisses"), so this is not a contract violation — but `compactMobile` (`src/components/ui/sheet.tsx:421,429`) also sr-onlys the title and `max-sm:hidden`s the 44px X on Preferences, Player settings, and Help. On a phone these are near-fullscreen bottom sheets, so the visible exits are: drag the small grabber, discover the thin backdrop sliver, or know Esc exists. A first-time mobile player who taps the gear sees a full-screen pane with zero labeled dismiss affordance. ui-self-review: every overlay needs a visible exit.
- Proposed change: keep the X visible on `compactMobile` sheets (the button already exists — it's one CSS class), or add a sticky "Done" footer button. Cheapest correct fix is dropping `max-sm:hidden` at `sheet.tsx:429`.

**F3 — Onboarding language buttons are ~28px tall on phones.**
- Evidence: `reports/ux-audit-1116/onboarding-welcome-phone-light.png` (audit: "English" 59×28, "Español" 62×28)
- Rule: DESIGN.md "Minimums: …44px targets". `welcomeStep.tsx:55` uses `<LanguageSwitcher size="sm" />`; the sm variant is `px-2.5 py-1.5` with no `max-sm:min-h-11`, unlike the default size (`languageSwitcher.tsx:43`). This is the first interactive element on the first screen every new player sees.
- Proposed change: add `max-sm:min-h-11` to the sm variant (or use the default size on the welcome step). One-class fix.

### P2

**F4 — No `prefers-color-scheme` fallback: dark-OS first-time users get a light app.**
- Evidence: `reports/ux-audit-1116/onboarding-welcome-phone-light.png`, `lobby-default-phone-light.png` (no dark onboarding exists to capture)
- Rule/impact: player-impact, first paint. `index.html` hardcodes `data-theme="light"` and `public/theme-init.js` only reads the saved preference; `useAppTheme` has no system fallback either. Theme is only reachable in Settings, which requires finishing onboarding — so every new visitor, including dark-mode users, gets light through the entire first run.
- Proposed change: in `theme-init.js`, when no saved pref exists, resolve `matchMedia("(prefers-color-scheme: dark)")`. Optionally add the existing `ThemeSegmented` to the onboarding welcome step.

**F5 — Game screens have no `<h1>`.**
- Evidence: `reports/ux-audit-1116/game-vs-friend-start-phone-light.png`, `online-quick-search-phone-light.png` (axe `page-has-heading-one`, moderate, on every in-game and online-waiting state; lobby passes)
- Rule: ui-accessibility (axe moderate). Screen-reader users lose page context the moment a game starts; the mode title in `playersPanel.tsx:507` is a styled `<span>`.
- Proposed change: render the mode title as `h1` (styled identically) or add a visually-hidden `h1` per game surface.

**F6 — Help sheet's scrollable body isn't keyboard-focusable.**
- Evidence: `reports/ux-audit-1116/lobby-help-phone-light.png`, `game-help-phone-light.png` (axe `scrollable-region-focusable`, serious, node `.pb-5`)
- Rule: ui-accessibility (axe serious). The sheet body at `sheet.tsx:508-512` scrolls (`overflow-y-auto`) but has no `tabIndex`, so keyboard users cannot scroll the tips list.
- Proposed change: add `tabIndex={0}` + an accessible name (`role="region"`, `aria-label` = sheet title) to the scrollable body, or make the dialog itself the scroll container.

**F7 — Desktop game HUD renders the mode label at 11px.**
- Evidence: `reports/ux-audit-1116/game-vs-friend-mid-desktop-light.png` (measurement: "vs Friend" at 11px; also "Online" in `online-connected` desktop)
- Rule: DESIGN.md "Minimums: 12px text". `playersPanel.tsx:506` uses `text-[11px]` at `sm:` and up (phone correctly bumps to `text-base`/`text-xl`).
- Proposed change: `text-xs` (12px) at `sm:`+. Cosmetic, one class.

**F8 — Online reaction quick-chat buttons are 36px tall on phones.**
- Evidence: `reports/ux-audit-1116/online-game-host-phone-light.png` (measurement: 10 reaction items at 174×36, "Mute reactions" 112×38)
- Rule: DESIGN.md "44px targets". `socialReactions.tsx:31,35` uses `px-3 py-2`/`px-2 py-2 text-sm` with no `max-sm:min-h-11`.
- Proposed change: add `max-sm:min-h-11` to the summary and reaction buttons.

**F9 — The game is completely silent.**
- Evidence: all `game-*.png` / `online-game-*.png`; code audit — zero `Audio`/`play()`/`webkitAudio` in `src/`
- Rule/impact: task criterion "sound/motion feel"; ui-craft game-feel. Motion is well done (pop-in, wiggle, win pulse — verified running), but a first-time player gets zero auditory feedback on place/vanish/win/turn. For a casual game announced on social, sound is the cheapest game-feel win available; today nothing exists to evaluate.
- Proposed change: minimal WebAudio blips (place, vanish, win, turn-start) behind a persisted mute — the reactions mute pattern already exists to copy. Keep it gesture-gated for autoplay policy.

**F10 — No progression hook after beating the AI.**
- Evidence: `reports/ux-audit-1116/game-over-win-phone-light.png`, `game-vs-computer-easy-phone-light.png`
- Rule/impact: "what would make a stranger play a second game." The record chip and breakdown are good retention surfaces, and "Play again" is prominent — but it restarts the *same* difficulty. A player who beats Easy has no in-flow reason to try Normal/Hard; they must discover the Players sheet. Online has rematch; vs-computer has no "next challenge" moment.
- Proposed change: on a vs-computer win below Hard, add a secondary action or one-line hint ("Beat Normal next?") that deep-links to the difficulty picker. Optionally a post-game "challenge a friend" CTA feeding the invite flow (F1).

## Suggested fix slices (~1 hour each)

1. **Touch-target sweep** — F3, F7, F8: three one-class CSS fixes (`max-sm:min-h-11` on sm language switcher + reaction controls; `text-xs` on the HUD mode label). Verify at 390px + axe re-run.
2. **Share loop** — F1: short room codes for friend rooms (generator + collision retry + copy update). The highest-leverage launch fix.
3. **Sheet exits + a11y batch** — F2, F5, F6: un-hide the compact-mobile X (or Done footer), `h1` on game surfaces, `tabIndex` on the sheet scroll body. One axe re-run verifies all three.
4. **Feel + retention** — F4, F9, F10: `prefers-color-scheme` fallback in `theme-init.js`, minimal audio blips with mute, post-win difficulty nudge. Largest slice; F4 alone is ~15 min.

## Notes and limitations

- **No draw state exists.** `checkWinner` (`src/game/logic.ts:175`) only detects winners, and the vanish rule (3 marks max per player) makes a full board impossible — games end on a win, disconnect, or turn-clock forfeit. DESIGN.md's draw styling is unreachable spec. The requested "game over draw" screenshot cannot be captured honestly; this is documented here instead of faked. Player impact is neutral-to-positive (every game resolves decisively).
- **Onboarding is light-only by construction** (F4) — dark onboarding screenshots don't exist because the theme can't be reached pre-Settings.
- **Minor coverage gaps:** `lobby-players-you-*` and `lobby-players-difficulty-*` exist only at desktop size (the phone Players sheet is captured via `lobby-players-opponent-phone-*`); the measurement script's 1×1 "Skip to main content" hits are the standard visually-hidden skip link, not real targets; the 24×24 "Show record breakdown" button expands its hit area to 44px via a pseudo-element (`recordBreakdown.tsx:162`) — both verified non-issues.
- **Console:** the only errors captured are intentional `ERR_CONNECTION_REFUSED` from the service-down states and from runs while the local Worker was briefly down — no product console errors or warnings in any captured state.
- **Verified working (no findings):** reduced-motion emulation produces 0 running animations; keyboard Tab order is sane and the board is focusable + Enter-activatable; focus-visible rings present; no horizontal overflow at 390px or 1440px; all controls have accessible names; i18n (EN/ES) switcher works from onboarding and Settings; online error/down/bad-room states all render clear recovery copy; quick-match offers "play vs computer while you wait" — a genuinely good first-run online pattern.
