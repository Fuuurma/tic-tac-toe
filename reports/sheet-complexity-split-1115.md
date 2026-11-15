# Sheet complexity split — react-doctor verification (TTT-RD-SHEET-L70)

**Verdict:** DONE — `src/components/ui/sheet.tsx` split so both remaining
react-doctor rows clear. Verified at the landed sha on `origin/main`.

## Findings cleared

`stream/mechanical/2026-11-13-react-doctor-tic-tac-toe.md` (and the
`sheet-a11y2-verify-1113.md` re-run) carried two P3 rows on
`src/components/ui/sheet.tsx:70` (`export function Sheet`):

- `react-doctor/no-high-complexity-react-function` — control-flow
  complexity over the threshold
- `react-doctor/no-giant-component` — function body over 300 lines

## What changed

Same file, same public interface (`Sheet`, `SheetProps` unchanged). The
single 316-line component became an orchestrator plus file-local pieces,
matching the repo's "a module used by one component stays beside it" rule
and the `useVanishGhost` precedent in `boardCell.tsx`:

- `useSheetPresence(open)` — isPresent/previousOpen render-adjust, exit
  fallback timer, `finishExitAnimation`
- `useIsPhone()` — matchMedia `(max-width: 639px)` state + listener
- `useBodyFits(bodyRef, isVisible, dragFromBody)` — the scrollHeight fit
  measurement behind `dragAnywhere`
- `useSheetChrome({dialogRef, scrimRef, onCloseRef, isVisible, inline,
  phoneOverlay})` — the three dialog-chrome effects verbatim: modal
  showModal/close, inline Esc + focus trap + focus restore, backdrop click
  listeners (the ttt-rd-sheet-a11y1 native-listener fix is preserved
  exactly)
- `SheetHeader` — grabber, title row, close button (owns the previously
  unread `closeRef`)
- `SheetPanel` — drag surface wrapper + header + scroll body + footer

Every effect body, dep list (plus the now-param refs, which are stable),
className recipe, comment and DOM node moved verbatim; hook order is
unconditional and identical in shape to the original. Effect dep arrays
gained `dialogRef`/`scrimRef`/`onCloseRef`/`bodyRef` because they are now
hook params rather than local `useRef` results — stable objects, so
re-run behaviour is unchanged.

## Verification

- `npx react-doctor@0.9.14 --json --no-score src/components/ui/sheet.tsx`:
  **0 react-doctor diagnostics** (baseline had exactly the two target
  rows; repo-wide the file is clean).
- `pnpm lint` — clean.
- `pnpm test` — 907 tests / 78 files, green (sheet.test.tsx pins the
  F793 modal routing, backdrop dismissal and F809 focus ring unchanged).
- `pnpm build` (`tsc -b && vite build`) — exit 0.
- Headless check at 390x664 (hasTouch, isMobile) against `pnpm preview`
  of the built `dist/`, driven by playwright@1.64.1 → cached
  chromium_headless_shell-1248 (this repo pins @playwright/test 1.61.1,
  which wants the absent 1228 shell; 1.64.1 was borrowed read-only from a
  sibling worktree's node_modules): 6/6 — Settings sheet opens named and
  `:modal`, Esc dismisses, backdrop tap dismisses; Players sheet opens
  named, Esc dismisses. Note: `compactMobile` hides the X on phone by
  design, so Close-button dismissal is a desktop-only path and was not
  exercised at 390px.

`pnpm test:e2e` was not run: it needs the matchmaking Worker on
127.0.0.1:8787 and this change touches no online-play code path; the
sheet behaviour it would exercise is covered by the headless check above
plus the unit pins.
