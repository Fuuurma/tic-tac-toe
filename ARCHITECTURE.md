# tic-tac-toe — Architecture

Guest-first online tic-tac-toe: React 19 (Vite 8) SPA deployed to
Cloudflare Pages (`wrangler pages deploy dist`). The game core is pure and
self-play-tested (`src/game`: rules, AI with behavior/selfplay/bench
suites); identity is generated locally so play never requires an account.
Online rooms go through the shared `fuurma-matchmaking` Worker (quick-match
pairing + `GameRoomDO` WebSocket relay); host-authoritative validation runs
client-side in `src/lib/peer.ts`.

The architecture, drawn: **[diagrams/architecture.html](diagrams/architecture.html)**
(diagram-design editorial HTML — refresh it when modules or data flows change;
never redraw it as Mermaid). It keeps both paths: guest identity into the
React UI, hooks, and the pure game engine for local play, and the UI through
the host-authoritative peer room and matchmaking client onto the external
`fuurma-matchmaking` relay for online rooms.

## Modules

- src/game — pure engine: logic.ts rules, ai.ts (easy random / normal d4 / hard d8 alpha-beta; behavior + selfplay + bench suites), constants
- src/hooks — usePeerRoom (online), useLocalGame, useGameStats
- src/lib/peer.ts — peer-room transport with host-authoritative move validation (hostile-input test suite)
- src/lib/matchmaking.ts — relay URL acquisition, FIFO queue position reporting
- src/lib/room.ts + roomId.ts — room client wrapper and room id helpers
- src/lib/identity.ts — generated guest identity, localStorage-backed
- src/components — game board and lobby surfaces
- e2e/ — Playwright smoke tests
- deploy — `wrangler pages deploy dist` (Cloudflare Pages)
- fuurma-matchmaking (separate Worker) — pairing + GameRoomDO relay; not in this repo
