# Test-file audit — tic-tac-toe — 2026-10-15

Scope: the change-detector archetype from the 2026-10-03 fleet test review; verdicts cover every current `src/**/*.test.*` file and Playwright spec. This is not a new broad test-quality classifier. Base: `origin/main` at `477af263`.

The 2026-10-03 audit is preserved in [test-file-audit-2026-10-03.md](test-file-audit-2026-10-03.md). Since that review, the tracked suite grew from 25 to 44 Vitest files and from 2 to 3 Playwright specs. `e2e/matchmaking.ts` is a shared helper, not a spec. The WORK row's “323 test files” count does not match the repository inventory.

## Finding

**TTT-AF1 — rewrite the AI difficulty browser flow.** `e2e/smoke.spec.ts` selected the default `Normal`, asserted a fixed radio count and absent `Insane` option, then checked that the AI responded. A broken selection handler that forced the default back to `Normal` still passed. The test now chooses `Hard`, verifies the radio becomes checked, starts the game, and verifies the player card carries `(Hard)` before checking the AI response.

Red proof: with `LobbyForm` temporarily changed to always store `Normal`, the old test passed and the rewritten test failed because `Hard` remained unchecked. Restoring the production handler made the rewritten test pass. The mutation was not retained.

No additional e2e flow was needed: the existing local-game scenario now exercises the previously unpinned selection path. The private-room, quick-match, rematch, and host-pause specs already drive real browser flows.

## File verdicts

Verdicts apply to the named archetype. `KEEP` means the file tests a product behavior or stable user, wire, storage, or documentation contract rather than merely detecting a constant edit. Unchanged files from the prior review retain that review's result.

| File | Verdict | Reason |
|---|---|---|
| `src/__tests__/agentsStructure.test.ts` | KEEP | Detects nonexistent paths in the documented project map. |
| `src/__tests__/peerProtocol.test.ts` | KEEP | Exercises guest rollback, rematch identity, snapshot, and pause protocol behavior. |
| `src/components/backgroundPattern.test.tsx` | KEEP | Checks resize, reduced-motion, trail, and bounded repaint behavior. |
| `src/components/game/board.render.test.tsx` | KEEP | Guards the measured board render cost on timer ticks and updates after moves. |
| `src/components/game/board.test.tsx` | KEEP | Checks accessible cell labels, disabled behavior, and click results. |
| `src/components/game/confirm.test.tsx` | KEEP | Checks dialog actions and safe initial focus. |
| `src/components/game/onlineGameSurface.test.tsx` | KEEP | Covers rematch controls, result deduplication, quick-match privacy, and queue copy. |
| `src/components/game/playersPanel.test.tsx` | KEEP | Covers confirmation lifecycle, clipboard behavior, and the displayed AI tier. |
| `src/components/game/recordBreakdown.test.tsx` | KEEP | Checks opening, closing, and rendered record rows through the component. |
| `src/components/lobby/colorPicker.test.tsx` | KEEP | Checks the single-select keyboard and accessibility contract. |
| `src/components/lobby/gameMark.test.tsx` | KEEP | Verifies the rendered brand mark follows the shared color tokens. |
| `src/components/lobby/gameModeSelector.test.tsx` | KEEP | Checks visible mode labels, descriptions, and selection semantics. |
| `src/components/lobby/lobbyForm.test.tsx` | KEEP | Checks online action descriptions exposed to assistive technology. |
| `src/components/lobby/playerSettingsSheet.test.tsx` | KEEP | Checks the named modal, close action, and tablist. |
| `src/components/lobby/symbolShapePicker.test.tsx` | KEEP | Checks accessible names and the icon-only picker behavior. |
| `src/game/ai.behavior.test.ts` | KEEP | Exercises legal choices, immediate tactics, and eviction wins. |
| `src/game/ai.bench.test.ts` | KEEP | Measures actual move latency across representative game states. |
| `src/game/ai.selfplay.test.ts` | KEEP | Checks legal self-play and seeded difficulty separation. |
| `src/game/ai.test.ts` | KEEP | Covers actual AI decisions and the difficulty enum/labels used by protocol and UI. |
| `src/game/engine-purity.test.ts` | KEEP | Protects deterministic engine time injection against wall-clock leakage. |
| `src/game/game.property.test.ts` | KEEP | Checks game invariants over reachable generated states. |
| `src/game/logic.test.ts` | KEEP | Exercises moves, eviction, wins, and default player configuration; the prior audit marked the short config check marginal-keep. |
| `src/hooks/localTurnTimer.test.ts` | KEEP | Checks forced-move notices and pause/resume behavior. |
| `src/hooks/peer-room/guestProtocol.test.ts` | KEEP | Checks snapshot solicitation, reconnect convergence, and host-pause messages. |
| `src/hooks/peer-room/hostProtocol.test.ts` | KEEP | Checks host sync, guest move rejection, and rematch state transitions. |
| `src/hooks/peer-room/matchmaking.test.ts` | KEEP | Checks attempt cleanup, cancellation, and current matchmaking results. |
| `src/hooks/peer-room/relayEvents.test.ts` | KEEP | Checks reconnect and peer-left outcomes across live and terminal states. |
| `src/hooks/peer-room/roomLifecycle.test.ts` | KEEP | Checks room-entry resets and reconnect state behavior. |
| `src/hooks/useDragToDismiss.test.tsx` | KEEP | Checks swipe dismissal, settling, reopening, and disabled gestures. |
| `src/hooks/useGameStats.hook.test.tsx` | KEEP | Checks result recording, per-mode buckets, and persistence through the hook. |
| `src/hooks/useGameStats.test.ts` | KEEP | Checks stored-data validation and breakdown rows. |
| `src/hooks/useLocalGame.test.tsx` | KEEP | Checks timeout, same-tick moves, and the difficulty captured at game creation. |
| `src/hooks/usePeerRoom.disconnectTimer.test.tsx` | KEEP | Checks timer handling during disconnect and reconnect transitions. |
| `src/hooks/usePeerRoom.rematchTimeout.test.tsx` | KEEP | Checks expiry and cancellation of real rematch timeout paths. |
| `src/hooks/usePlayerCount.test.tsx` | KEEP | Checks poll and refocus-listener cleanup after unsubscribe. |
| `src/lib/errorReporting.test.ts` | KEEP | Checks error delivery through configured reporting boundaries. |
| `src/lib/identity.test.ts` | KEEP | Checks input sanitization, Unicode boundaries, and stored identity behavior. |
| `src/lib/matchmaking.test.ts` | KEEP | Checks response parsing, health validation, and online-player totals. |
| `src/lib/peer.hostile.test.ts` | KEEP | Checks hostile wire frames against protocol trust-boundary rules. |
| `src/lib/peer.test.ts` | KEEP | Checks move authorization, join/resync, and forfeit behavior. |
| `src/lib/preferences.test.ts` | KEEP | Checks preference persistence, patch merging, and invalid stored values. |
| `src/lib/radioGroup.test.ts` | KEEP | Checks keyboard navigation and boundary behavior. |
| `src/lib/room.test.ts` | KEEP | Checks handshake timeout, reconnect deduplication, and credentials at the socket boundary. |
| `src/lib/roomId.test.ts` | KEEP | Checks room ID normalization and malformed-input rejection. |
| `e2e/host-pause.spec.ts` | KEEP | Drives two clients through a real relay pause and verifies the guest clock freezes. |
| `e2e/quick-match.spec.ts` | KEEP | Drives two clients through pairing, room-code privacy, and a synchronized move. |
| `e2e/smoke.spec.ts` | REWRITE | The AI scenario now selects non-default Hard and verifies selection reaches the game; remaining tests drive user-visible local and online flows. |
