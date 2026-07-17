# Project Status - TicTacToe

**Last Updated:** July 17, 2026
**Status:** Guest-first public preview; current relay hardening is local and public network release smoke is pending

---

## Current Metrics

- **Architecture:** Vite + React SPA on Cloudflare Pages; shared `fuurma-matchmaking` Durable Object WebSocket relay.
- **Verification:** lint, type/build, 40 unit tests, local browser smokes, and a
  relay match/rematch pass.
- **Features:** strategic three-piece rule, four AI levels, local 2P, relay rooms,
  invite links, host-authoritative turns/timers, and local stats.

---

## Health Check

### Code Quality
- [x] Linting configured
- [x] Logic extracted to hooks
- [x] Peer protocol validates message shape and actor authorization
- [x] Host owns online game state and timeout moves

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

---

## Next Actions

1. [ ] Deploy the current shared Worker and Pages build.
2. [ ] Run local and public Playwright smoke.
3. [ ] Test relay pairing and reconnect across two different real networks.
4. [ ] Verify 30-second expiry and keep guest play independent of OAuth.
