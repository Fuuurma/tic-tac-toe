# Tic-tac-toe codebase audit, 2026-07-26

## Scope and protected work

- Repository: `/Users/sergi/Projects/tic-tac-toe`
- Branch/commit at audit: `main`, `711ce57` (clean relative to origin before protected WIP; current tree is intentionally dirty)
- Product stage: `building`
- Live slice: guest-first Vite/React strategic three-piece Tic-tac-toe with local 2P, Easy/Normal/Hard AI, private WebSocket rooms, and shared quick matchmaking.
- Public URL: `https://tic-tac-toe-1ou.pages.dev`, explicitly an older preview, not a production launch.
- Protected paths observed and not edited: `AGENTS.md`, `README.md`, `e2e/smoke.spec.ts`, `src/App.tsx`, `src/components/auth/loginForm.tsx`, `src/components/auth/playerSymbolPicker.tsx`, `src/components/auth/gameMark.tsx`, `src/components/game/**`, `src/components/ui/**`, `src/game/**`, `src/hooks/useLocalGame.ts`, `src/hooks/usePeerRoom.ts`, `src/index.css`, and `src/lib/peer.ts` plus their tests. Two deleted win-line files and new AI/color/component tests are preserved as WIP.
- The audit file was created in a previously absent clean path. No protected WIP was overwritten, staged, or reformatted.

## Stack and structure

- Vite 8.1.5, React 19.2.8, TypeScript 6 alias plus native TypeScript 7 alias, Tailwind 4, shadcn-style local components, Cloudflare Pages static output.
- Shared `fuurma-matchmaking` Worker and `GameRoomDO` provide quick-match HTTP and room WebSockets. The client is guest-only and does not use Convex, Better Auth, Stripe, or email.
- Pure rules and AI live under `src/game`; room lifecycle is in `src/lib/room.ts` and `src/hooks/usePeerRoom.ts`; UI is componentized under `src/components`.
- No product CI workflow exists under `.github/workflows`; `.github/copilot-instructions.md` is stale Next.js/Socket.IO guidance and should not be used as current architecture guidance.
- No manifest is linked or shipped. `index.html` has viewport, description, and theme-color metadata only. This is truthful only because the product does not currently promise PWA installation.

## Validation evidence

| Command/check | Result | Evidence |
|---|---:|---|
| `pnpm test` | PASS, 7 files / 55 tests | Vitest output, including AI behavior and self-play suites |
| `pnpm lint` | PASS | ESLint exited 0 |
| `pnpm build` | PASS | Vite 8 build, hashed JS/CSS output |
| `pnpm deploy:check` | PASS | Build succeeded and `dist/ looks ready` |
| `pnpm audit --audit-level=high` | BLOCKED/FAIL | Existing transitive high advisories: `sharp` via wrangler/miniflare and `brace-expansion` via eslint/minimatch. No dependency changes were made in this protected-WIP audit. |
| `pnpm exec playwright test` against `127.0.0.1:3230` with local Worker `127.0.0.1:3232` | FAIL, 11/13 passed | Quick-match host wait expected old copy while UI showed `Room ready`; private-room test expected board before opponent joined while UI correctly showed waiting room. These are stale/incorrect smoke assumptions, not silently claimed passes. |
| Desktop agent-browser smoke | PASS | Local preview shell opened, accessible snapshot showed heading, player symbol/name/color controls, mode controls, AI levels, and Start Game. Screenshot: `/tmp/portfolio-deep-audit-evidence/tic-tac-toe-desktop.png` |
| 390x844 agent-browser smoke | PASS for setup shell | Mobile snapshot showed all setup controls and Start Game reachable. Screenshot: `/tmp/portfolio-deep-audit-evidence/tic-tac-toe-mobile.png` |
| Local Worker health | PASS | `curl http://127.0.0.1:3232/` returned `{"ok":true,"service":"fuurma-matchmaking"}` |
| Public root | PASS as preview shell | `https://tic-tac-toe-1ou.pages.dev/` returned 200 HTML and title `Tic Tac Toe` |
| Public `/manifest.json` | NOT A MANIFEST | Returned 200 HTML, not JSON. No manifest link exists in current source, so this is not a linked-resource failure, but it must not be described as PWA-ready. |

## G1-G4 readiness

- G1 live-slice behavior: **2/3**. Local setup, local 2P, AI start/response, three-piece eviction, winner highlighting, player symbol/color choices, and reset/exit state logic are covered by 55 unit tests and local browser smoke. Private/quick online flows are not green against the local Worker because the current E2E assumptions do not match the waiting-room UI, and hostile-frame/reconnect expiry probes were not executed live.
- G2 UI/UX: **2/3**. Desktop and setup mobile shell are usable, semantic controls and 3x3 board exist, and the board is large enough for touch. In-game 390x844 board/online/reconnect visual proof is still missing. Player-panel icon controls use sub-44px mobile targets.
- G3 stack/proof: **1/3**. Native tests/lint/build/deploy preflight are green, but no CI workflow exists, stale Copilot guidance remains, dependency audit has high transitive findings, and browser online proof is red.
- G4 deploy: **0/3**. Public URL is an older preview. No current Pages deployment or two-network Worker/Pages smoke was performed. Do not call this production-ready.

## Findings and protected WIP decisions

### P1, release/proof blockers

1. **Online browser contract is not currently proven.** The local Worker and Pages preview start successfully, but the 13-test browser run had 2 failures. The quick-match test waits for `Waiting for opponent|Finding match|Opponent: Guest`, while the rendered host state is `Room ready` with a room code. The private-room test expects a board immediately after host room creation, while the product intentionally shows a waiting room until the guest joins. These tests must be reconciled with the current intentional waiting-state UI before online assertions can pass.
2. **Current public preview is stale relative to local relay changes.** The README and project metadata correctly say deployment and two-network validation remain outstanding. No deploy was attempted.

### P2, correctness/performance/proof

3. **Inbound peer game-state validation is structural but incomplete.** `src/lib/peer.ts` validates board shape, symbols, basic players/moves objects, and status, but does not fully validate player usernames/colors, move-history index bounds, winning-combination consistency, `lastMoveIndex`, timer bounds, or game-mode/max-moves enums. The trusted-host model limits impact on host state, but a hostile relay peer can make the guest render incoherent state. This remains protected WIP and is a follow-up candidate, not an applied change.
4. **Guest `rematchAccept` can reset the host mid-game.** `usePeerRoom.ts` handles any relayed `rematchAccept` by creating and broadcasting a fresh game without proving a host rematch request or terminal state. This can be abused by a hostile guest and is a core-state integrity risk. It is in a protected dirty file and was not edited.
5. **Reconnect timer continuity needs explicit proof.** On `peer-left: disconnect`, the host timer stops; on `peer-reconnected`, it restarts using the stale `turnTimeRemaining`. A low remaining value can immediately trigger timeout fallback after reconnect. The room contract and Worker tests cover grace/expiry, but a two-client reconnect probe against this client was not run.
6. **Normal/Hard AI are synchronous and unbudgeted.** Normal runs 900 MCTS simulations and Hard searches depth 12 on the browser main thread. Existing self-play proves legality and bounded test runtime, not mobile long-task/input responsiveness. A Web Worker or cooperative deadline, plus a browser long-task budget, is recommended before claiming every device is non-blocking.
7. **Hard AI repetition scoring is heuristic, not a solved minimax guarantee.** Path repetition is scored neutral; no independent exhaustive oracle proves non-loss across reachable three-piece states. Keep the current Hard algorithm and WIP tests, but label the difficulty honestly as adversarial/history-aware rather than mathematically solved until such proof exists.
8. **Game reducer allows direct moves from `WAITING`.** `isValidMove` checks turn, occupancy, range, winner, and status-adjacent conditions but not `gameStatus === ACTIVE`; `makeMove(freshGameState(), ...)` can transition waiting to active. UI currently guards this path. Add a regression test and fix only after protected game WIP ownership clears.
9. **Mobile browser coverage is setup-only.** The 390x844 test checks Start Game reachability, not the in-game board, player panel, online waiting, winner, or reconnect states. The manual mobile snapshot is setup evidence only.
10. **Transitive dependency audit is red.** `sharp` inherited through wrangler/miniflare and `brace-expansion` through eslint/minimatch have high advisories. Do not upgrade dependencies inside this protected WIP without reviewing lockfile ownership and compatibility.

### P3, documentation/maintenance

11. `README.md` says Vite 5 while package.json uses Vite 8.1.5. `AGENTS.md` says `VITE_USE_WS_ROOM=true` remains in `.env.production`, but the file contains only the public matchmaking URL and the client uses WebSockets unconditionally. Remove or correct stale claims when documentation ownership is transferred.
12. `.github/copilot-instructions.md` describes a different Next.js/Socket.IO/TicTacToeMobile project and should be replaced or removed in a future clean documentation pass. It was not edited because guidance is protected.
13. No `.github/workflows` CI exists. Add a minimal check workflow only as a separately owned clean-path change, with reserved local service handling for online smoke.
14. No PWA manifest is linked. This is not a failure of the current declared static preview contract because no manifest is promised, but a future PWA claim requires a valid manifest, icons, and resolvable assets. `/manifest.json` currently returns HTML from the Pages SPA fallback.
15. Mobile player-panel reset/leave icon buttons use 28px default targets. Increase hit areas when the dirty UI path is intentionally owned.

## Contract status matrix

| Assertion | Status/evidence |
|---|---|
| VAL-GAME-TTT-001 | **Partial**: local 2P and all AI starts/response pass in unit/browser smoke; AI mobile full-board responsiveness not proven. |
| VAL-GAME-TTT-002 | **Partial**: 20 logic tests and visible oldest-marker/winner smoke pass; no exhaustive property/oracle proof. |
| VAL-GAME-TTT-003 | **Partial**: 390x844 setup snapshot and fixed hit area pass; no in-game mobile board smoke. No manifest is linked, so `/manifest.json` is not a declared release gate. |
| VAL-GAME-TTT-004 | **Blocked**: two-client private/rematch flow did not reach the board in local smoke, and no current deployment smoke was run. |
| VAL-GAME-TTT-005 | **Blocked**: no live hostile-frame injection. Unit structural validators exist but are incomplete. |
| VAL-GAME-TTT-006 | **Blocked**: Worker has lifecycle tests, but no client two-browser reconnect/leave/expiry probe was completed. |
| VAL-GAME-TTT-007 | **Blocked**: quick match local smoke failed before pairing due to stale expected waiting text; public URL is an older preview and no current Worker/Pages deployment was made.

## Next actions

1. Transfer ownership of the current dirty AI/game/network files, then add regression-first tests for active-state moves, rematch gating, reconnect timer reset, and hostile game-state validation.
2. Update Playwright private/quick tests to wait for `Room ready`/room code and allow the host waiting state before expecting a board. Keep the intentional focused waiting UI; do not remove it to satisfy stale tests.
3. Add a real two-browser local Worker smoke for private room, valid move relay, hostile frame rejection, reconnect within grace, final expiry, and rematch. Repeat against a newly deployed preview only after local proof is green.
4. Benchmark Normal/Hard on representative mobile viewport/device hardware, then choose a Web Worker or deadline-based search if the budget is exceeded.
5. Correct stale README/AGENTS/Copilot guidance, add CI, and decide explicitly whether PWA support is in scope. If it is, add and link a valid manifest with icons; otherwise preserve the honest non-PWA preview caveat.
6. Re-run `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm deploy:check`, dependency audit, and browser smoke after ownership transfer.

## Reusable lessons

- A waiting-room UI is part of the multiplayer contract. E2E should assert the waiting state after host creation and only assert the board after the second client joins.
- For guest-first games, client validators must be stricter than TypeScript casts even when the relay is intended to be authoritative. Validate wire state before writing it to React state.
- AI self-play legality does not prove main-thread responsiveness. Add a measured long-task/input-latency budget for mobile before calling an AI mode non-blocking.
- A public SPA returning HTML for an unlinked `/manifest.json` is not evidence of a broken manifest. The release gate is conditional on whether `index.html` links one.
