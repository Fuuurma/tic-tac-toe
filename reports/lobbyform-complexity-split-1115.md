# LobbyForm complexity split — react-doctor verification

**Verdict:** DONE — `src/components/lobby/lobbyForm.tsx` split so both
react-doctor rows on `LobbyForm` clear. Verified on the lane branch before
landing on `origin/main`.

## Findings cleared

`stream/mechanical/2026-11-13-react-doctor-tic-tac-toe.md` / WORK.md row
(auto-intake 2026-11-15) carried a P2 row on
`src/components/lobby/lobbyForm.tsx:113` (`export function LobbyForm`):

- `react-doctor/no-high-complexity-react-function` — cyclomatic 52,
  cognitive 55, max nesting 3
- `react-doctor/no-giant-component` — component body over 300 lines
  (533-line function in an 817-line file)

## What changed

Same file, same public interface (`LobbyForm`, `LobbyFormProps`,
`LobbyFormPayload` unchanged). The ~530-line component became an
orchestrator plus file-local pieces, matching the `playersPanel.tsx`
(`b53f26b`) and `onlineGameSurface.tsx` (`da252ae`) splits and the repo's
"a module used by one component stays beside it" rule:

- `useLobbyPlayers(initialRoomId)` — display name, colour/shape picks,
  game mode, AI difficulty, opponent name/type, the three settings-sheet
  change handlers, the `usePlayerCount` subscription and the render-phase
  server-down fallback, all verbatim
- `useOnlineMatch(initialRoomId)` — room code, match action and the
  explained-dead-action state with `actionDeadReason` /
  `chooseOnlineAction`, verbatim
- `LobbyCardHeader` — masthead (`GameMark`, wordmark) plus the preferences
  gear button
- `OnlineMatchSection` — population readout, the Quick/Create/Join
  radiogroup and the two room-code `Field`s
- `LobbyCardFooter` — the sticky submit `Button` with its per-mode label
  and the start-blocked reason line
- Plain (non-React) helpers hold the branchy derivations so no extracted
  piece re-trips the complexity rule (react-doctor checks `useX` hooks
  too): `initialPlayerColor`, `initialPlayerShape`,
  `initialOpponentColor`, `initialOpponentShape`, `initialAI_Difficulty`,
  `initialOpponentName`, `initialGameMode`, `initialOnlineAction`,
  `quickMatchBlockReason`, `lobbyDisabledModes`, `lobbyStartGate`

Every comment, className recipe, dep list, DOM node and prop condition
moved verbatim; the only renames are prop names on the three new section
components (`onOpenPreferences`, `onChooseAction`, `deadReason`,
`onRoomIdChange`). `useState` initializers that read `initialPrefs` are
now lazy `() => initial…(initialPrefs)` calls — same first-render value,
evaluated once instead of every render.

## Verification

- `npx react-doctor@0.9.14 --json --scope files
  src/components/lobby/lobbyForm.tsx`: **0 diagnostics** (baseline had
  exactly the two target rows at :113).
- `pnpm lint` — clean.
- `pnpm test` — 907 tests / 78 files, green (the three `lobbyForm*.test.tsx`
  suites pin the online-option, server-down and unavailable behaviours
  unchanged).
- `pnpm build` (`tsc -b && vite build`) — exit 0.
- Render equivalence: a temporary vitest module rendered the pre-split
  (`git show HEAD:`) and post-split `LobbyForm` side by side across four
  scenarios (default, Online+Quick, Online+Create, friend mode) —
  `innerHTML` identical after normalising `useId` values. Removed after
  the check.

`pnpm test:e2e` was not run: it needs the matchmaking Worker on
127.0.0.1:8787 and this change touches no protocol or wire code — only
render-tree composition inside one component.
