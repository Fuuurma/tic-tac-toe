# UX fixes F2 + F5 + F6 + F7 — verification (TTT-UX-FIX3)

Fixes four findings from the launch-readiness UX audit
(`reports/ux-audit-1116.md` @680792b): the hidden compact-mobile sheet
close, the missing game-surface level-one heading, the keyboard-
unreachable sheet body, and the sub-12px HUD label.

## Change

- **F2** — `src/components/ui/sheet.tsx`: `compactMobile` no longer wraps
  the header control cluster in `max-sm:hidden`; the 44px labeled close X
  renders on phones, end-aligned (`max-sm:justify-end`) where the
  sr-only title's `justify-between` would otherwise strand it at the
  left edge. Dismissal still works via X, swipe, Esc and backdrop.
- **F5** — `src/components/game/playersPanel.tsx`: the HUD mode title is
  now an `<h1>` styled identically to the old `<span>` (axe
  `page-has-heading-one` fired on every game state).
  `src/components/game/onlineGameSurface.tsx` adds a visually-hidden
  `<h1>` for the banner-only waiting/error states that never mount the
  panel, so exactly one level-one heading exists in every state.
- **F6** — `src/components/ui/sheet.tsx`: the `overflow-y-auto` body is
  now `role="region"`, `aria-labelledby` the sheet title, `tabIndex=0`
  (axe `scrollable-region-focusable`, serious). Applies to every sheet:
  Settings, Players, Help, confirm flows.
- **F7** — `src/components/game/playersPanel.tsx`: the desktop HUD mode
  row moves from `text-[11px]` to `text-xs` (12px, DESIGN.md minimum);
  `max-sm:text-base` phone sizing unchanged.

## Gates

`pnpm lint`, `pnpm test` (82 files / 954 tests), `pnpm deploy:check`,
`pnpm build` — all green. e2e (`smoke`, `queue-play`, `quick-match`,
`host-pause` on the preview bundle, worker on :8787): 33/35 green; the
two reds are `smoke.spec.ts` persona-name and phone sheet-drag timing
tests — see attribution below.

## Re-run of the audit's checks

After-shots in `reports/ux-audit-1116/after/` (390×844 + 1440×900, light;
dark for the two axe-flagged states), captured by
`audit/capture-after-f2-f5-f6-f7.mjs`; measurements in
`after/measurements-f2-f5-f6-f7.json`.

| Finding | Before (audit) | After (this slice) |
|---|---|---|
| F2 hidden close X | `lobby-help-phone-light.png` — no visible exit | `after/lobby-help-phone-light.png` — close X 44×44 at (326,234); `lobby-settings-*`, `lobby-players-opponent-*`, `game-help-*` same sheet |
| F5 no h1 | `game-mid`/`game-over-win`/`online-waiting`/`online-connected` — `page-has-heading-one` | mode title is the h1; `after/game-vs-friend-mid-*` (4 variants) + `after/online-waiting-*` — axe clean |
| F6 body not focusable | `lobby-help-phone-light.png` — `scrollable-region-focusable` (serious) | body is named region + tabIndex=0; `after/lobby-help-*`, `after/lobby-settings-*`, `after/game-help-*` — axe clean |
| F7 11px label | HUD mode row `text-[11px]` | `text-xs`; visible in `after/game-vs-friend-*-desktop-light.png` |

Axe re-run (16 states): zero violations — the audit's F5/F6 entries are
gone. `game-over-win` and `online-connected` share the PlayersPanel h1
mechanism proven by `game-mid`; the waiting/error h1 is covered by
`online-waiting` and unit tests.

## E2E attribution

Two `smoke.spec.ts` reds on the gate run: "the computer plays under its
persona name" (NPC turn-line timing) and "a bottom sheet follows the
finger" (touch-drag spring physics). Rerun of exactly those two specs:

- this slice @837ba96 — **both pass** (1.3s / 2.9s);
- pristine `origin/main` @12d87d2 — the drag test **fails identically**
  (sheet rests 351px low instead of springing back), persona passes.

Both are load-sensitive flakes in areas this diff does not touch (drag
handlers in `useDragToDismiss`, the AI think delay); the drag red
reproduces on pristine main — baseline-flaky, not this slice.

## Open / notes

- `online-connected` and `game-over-win` axe states were not
  re-captured (they need a two-client game / a completed game); the same
  h1 code path is covered by `game-mid` shots and unit tests.
- Sheet body `role="region"` adds one tab stop per open sheet —
  intentional: it is the scroll container keyboard users need.
