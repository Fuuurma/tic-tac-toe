# OnlineGameSurface complexity split — react-doctor verification

**Verdict:** DONE — `src/components/game/onlineGameSurface.tsx` split so both
react-doctor rows on `OnlineGameSurface` clear. Verified at the landed sha on
`origin/main`.

## Findings cleared

`stream/mechanical/2026-11-13-react-doctor-tic-tac-toe.md` carried a P2 row on
`src/components/game/onlineGameSurface.tsx:48` (`export function
OnlineGameSurface`):

- `react-doctor/no-high-complexity-react-function` — cyclomatic 78, cognitive
  62, max nesting 4
- `react-doctor/no-giant-component` — component body over 300 lines (530)

## What changed

Same file, same public interface (`OnlineGameSurface`, `OnlineGameSurfaceProps`
unchanged). The single 530-line component became an orchestrator plus
file-local pieces, matching the Sheet split (`a2cd7ae`) and the repo's "a
module used by one component stays beside it" rule:

- `useRecordOnlineResult(peer)` — the F474 terminal-episode result latch and
  its effect, verbatim
- `usePendingPlayerSettings(peer, config, setSettingsOpen)` — the buffered
  identity edits and `openSettings` refresh, verbatim
- Nine self-gating banner components inside the existing
  `empty:hidden` stack — each returns `null` unless its phase holds, so the
  parent's JSX carries no banner conditionals: `RoomWaitBanner`,
  `QuickSearchBanner`, `QuickMatchedBanner`, `WarmupQueueStrip`,
  `RoomCreatingBanner`, `RoomConnectingBanner`, `ReconnectingBanner`,
  `ConnectionErrorBanner`, `DisconnectedBanner`
- `OnlineGameArea` — `SocialReactions` + `PlayersPanel` + `Board`, with the
  board memos moved beside it
- `OnlineSheets` — `SettingsSheet` + `PreferencesSheet` + `HelpDrawer`
- Plain (non-React) helpers hold the branchy derivations so no extracted
  component re-trips the complexity rule: `localPlayerSymbol`, `hostPlayerFor`,
  `canRequestOnlineRematch`, `onlineRematchProps`, `boardPreview`,
  `isBoardInputDisabled`, `boardDisabledReason`, `onlineRoomCode`,
  `onlineSurfacePaused`

Every effect body, dep list, className recipe, comment and DOM node moved
verbatim. Two deliberate equivalences, both behaviour-identical:

- The pause-sync effect now keys on the derived `overlaysPaused` boolean
  (`settingsOpen || preferencesOpen || howToPlayOpen`) instead of the three
  primitives — the effect's output depends only on that OR, so re-run
  behaviour is unchanged. Wrapping it in a custom hook was tried first and
  reverted: `react-doctor/no-pass-live-state-to-parent` flags a parent state
  setter invoked inside a hook's effect.
- Rematch handler props keep the original `cond ? () => peer.fn() : undefined`
  arrow shape rather than `cond ? peer.fn : undefined` — the wrapper is what
  the rematch-prompt test pins (a peer mock without `acceptRematch` must still
  render the Accept button).

## Verification

- `npx react-doctor@0.9.14 --json --scope files
  src/components/game/onlineGameSurface.tsx`: **0 diagnostics** (baseline had
  exactly the two target rows).
- `pnpm lint` — clean.
- `pnpm test` — 907 tests / 78 files, green
  (`onlineGameSurface.test.tsx` 43/43 pins the rematch prompts, room-code
  disclosure, queue copy, warm-up handoff and F344 colour scope unchanged).
- `pnpm build` (`tsc -b && vite build`) — exit 0.

`pnpm test:e2e` was not run: it needs the matchmaking Worker on
127.0.0.1:8787 and this change touches no protocol or wire code — only
render-tree composition inside one component. The online surface's behaviour
is pinned by the mocked-`usePeerRoom` unit suite above.
