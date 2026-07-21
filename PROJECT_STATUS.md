# Project Status - TicTacToe

**Last Updated:** July 21, 2026
**Status:** Guest-first public preview; codebase hardened via multi-round audit

---

## Current Metrics

- **Architecture:** Vite 5 + React SPA on Cloudflare Pages; shared `fuurma-matchmaking` Durable Object WebSocket relay.
- **Verification:** lint (0 warnings), type/build, 44 unit tests, 5 E2E smokes, local browser smokes, and a relay match/rematch pass.
- **Features:** strategic three-piece rule, four AI levels, local 2P, relay rooms, invite links, host-authoritative turns/timers, and local stats.

---

## Health Check

### Code Quality
- [x] Linting configured (0 warnings)
- [x] Logic extracted to hooks
- [x] Peer protocol validates message shape and actor authorization
- [x] Host owns online game state and timeout moves
- [x] Defensive draw detection in makeMove
- [x] localStorage failures handled gracefully (SecurityError, QuotaExceededError)
- [x] ARIA grid row structure for screen readers
- [x] Focus trap in Confirm dialog

### Platform Support
- [x] Static web build (Vite)
- [x] Cloudflare Pages preview
- [ ] Deploy current relay/client hardening and run public two-network smoke

### Core Features
- [x] 3-Piece Strategic Variant
- [x] AI Difficulty Levels (MCTS/Minimax)
- [x] Online Multiplayer (WebSocket relay)
- [x] Real-time Stats & Streaks
- [x] Minimal Anonymous Auth

### Test Coverage (post-audit)
- [x] Game logic: 20 tests (win, draw, 3-piece cap, removal + win interaction)
- [x] AI: 10 tests (all 4 difficulties, 3-piece cap interaction, INSANE/MCTS)
- [x] Peer protocol: 5 tests (message validation, move authorization)
- [x] Identity: 7 tests (sanitize, storage, persistence)
- [x] Room ID: 2 tests (normalize, reject)
- [x] E2E: 5 smoke tests (board, AI, friend mode, 3-piece visual, mobile)

---

## Audit Log (July 21, 2026)

Four rounds of systematic audit performed:

**Round 1 — Core bugs and code quality:**
- Removed dead `canMakeMove` function (always returned same value regardless of mode)
- Fixed `oppositeColor` asymmetric mapping (GREEN/PINK/PURPLE all mapped to GREEN)
- Aligned Vite version (devDep ^6.0.0 vs override ^5.4.0)
- Fixed `ai.test.ts` invalid state mutation (direct board overwrite)
- Added gameStatus check to timer callback (timer stops on game end, not just winner)
- Replaced fragile `JSON.stringify` key with stable composite key
- Fixed `useGameStats` race (initialized guestId synchronously)
- Added `gameStart` message to rematch protocol
- Memoized input object in `LocalGameSurface`
- Added Confirm dialog focus trap (Tab/Shift+Tab wrapping)

**Round 2 — Online play and resilience:**
- Stopped host timer on transient disconnect
- Broadcast state + restart timer on `peer-reconnected`
- Fixed `hasStartedRef` not resetting on quick match success
- Strengthened `isGameState` validator (players, moves, winner, gameStatus)
- Fixed `board.tsx` null cast type safety
- Added ARIA `role="row"` wrappers to board grid

**Round 3 — Test coverage and edge cases:**
- Added defensive draw detection in `makeMove`
- Rewrote `ai.test.ts` to use real `makeMove` calls (3-piece rule now exercised)
- Added INSANE/MCTS and 3-piece cap interaction tests
- Wrapped localStorage in try/catch for SecurityError/QuotaExceededError
- Strengthened `isGameState` with `maxMoves`/`moveCount`/`nextToRemove` checks
- Set `roleRef.current` directly in `joinAsGuest`/`startAsHost`
- Added tests for 3-piece removal + winning line interaction

**Round 4 — Final verification:**
- Fixed `room.ts` close handler socket clobber race (guarded `this.ws = null`)
- Verified all timer, stat dedup, broadcast, and cleanup logic is correct

---

## Next Actions

1. [ ] Deploy the current shared Worker and Pages build.
2. [ ] Run local and public Playwright smoke.
3. [ ] Test relay pairing and reconnect across two different real networks.
4. [ ] Verify 30-second expiry and keep guest play independent of OAuth.
