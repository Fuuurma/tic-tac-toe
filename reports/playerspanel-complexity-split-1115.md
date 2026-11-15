# PlayersPanel complexity split — react-doctor verification (TTT-RD-PLAYERSPANEL-L70)

**Verdict:** DONE — `src/components/game/playersPanel.tsx` split so both
react-doctor rows on `PlayersPanel` clear. Verified on the lane branch before
landing on `origin/main`.

## Findings cleared

`stream/mechanical/2026-11-13-react-doctor-tic-tac-toe.md` carried two P3 rows
on `src/components/game/playersPanel.tsx:111` (`export function PlayersPanel`):

- `react-doctor/no-high-complexity-react-function` — cyclomatic 69, cognitive
  64 at scan time
- `react-doctor/no-giant-component` — function body over 300 lines

## What changed

Same file, same public interface (`PlayersPanel`, `PlayersPanelProps`
unchanged). The ~500-line component became an orchestrator plus file-local
pieces, matching the `sheet.tsx` split precedent (a2cd7ae) and the repo's "a
module used by one component stays beside it" rule:

- `usePanelSize(panelRef)` — the ResizeObserver measurement behind the
  countdown ring's `panelSize`
- `useConfirmReset(isActive, freshGame, reset)` — the render-phase adjust that
  discards stored confirm prompts when the round ends or a fresh one starts
- `useActivePlayer(gameState)` — `isAITurn` + `activeLabel` derivation
- `TurnTimerOverlay` — bump-tab mask, countdown SVG ring and timer chip
- `PanelHeading` — game mark, mode label, room-code chip, record chip and the
  clamped status line
- `RoomCodeButton` — owns `copiedRoom`/`copyError` state and the clipboard
  write (returns null without a code, same as the old `roomCode &&` gate)
- `RecordChip` — the `stats.totalGames > 0` gate plus `RecordBreakdown`
- `HudActionButton` — the button shell written four times: `HUD_ACTION`
  className, icon size ternary, game-over label span
- `HudToolbar` — settings / identity / restart / exit actions over
  `HudActionButton`
- `PlayerCardGrid` — the two `PlayerCard` slots and their per-symbol props
- `ConfirmDialogs` — the exit and new-game `Confirm`s plus the human-color
  lookup their `playerColor` tint needs

The six confirm/click handlers now share one `setConfirmPause(paused)` fact
(ref write + `onPauseChange?.(paused)`), which the duplicated inline sequences
each wrote out. Every className recipe, comment, DOM node, prop condition and
effect body moved verbatim; hook order is unconditional and identical in
shape to the original.

## Verification

- `npx react-doctor@0.9.14 --json --scope files
  src/components/game/playersPanel.tsx`: **0 diagnostics** (baseline had
  exactly the two target rows).
- `pnpm lint` — clean.
- `pnpm test` — 907 tests / 78 files, green.
- `pnpm build` (`tsc -b && vite build`) — exit 0.
- Render equivalence: a temporary vitest module rendered the pre-split file
  (`git show HEAD:…playersPanel.tsx`) and the split file with identical props
  across a 10-case matrix — active online bare/full chrome/message/AI turn,
  terminal winner, rematch pending, draw, fresh game, exit-confirm open,
  new-game-confirm open — and compared serialized DOM with `useId` values
  normalized (wrapper components legitimately shift React's id paths). All 10
  cases byte-identical; the temporary module and test were deleted after the
  check.

`pnpm test:e2e` was not run: it needs the matchmaking Worker on
127.0.0.1:8787 and this change touches no online-play code path; the DOM
equivalence check above covers the rendered surface the specs would exercise.
