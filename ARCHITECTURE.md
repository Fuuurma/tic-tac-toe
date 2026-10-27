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

The layers only point one way: `components → hooks → lib → game`. There are
zero upward imports (`game` imports nothing from lib/hooks/components, `lib`
imports no hook or component), which is what keeps the engine testable without
a DOM and the protocol testable without React.

- src/game — pure engine, React-free by test: logic.ts rules, ai.ts (easy random / normal d4 / hard d8 alpha-beta; behavior + selfplay + bench suites), turnClock.ts (the freeze/rebuild pair), palette.ts, shapeGeometry.ts, tutorial.ts, constants
- src/lib/peer.wire.ts — the wire union, the scalar bounds and the validators (`isPeerMessage`, `isGameState`); the trust boundary, no user copy
- src/lib/peer.apply.ts — the pure state transitions over an admitted frame (`applyAuthorizedMove`, `applyHostGuestJoin`, `applyForfeitIfActive`)
- src/lib/room-protocol/ — the host/guest protocol state machine: message handling, room lifecycle, relay events, the turn timer, and `state.ts` (the `PeerRoomState` vocabulary). Not a hook — nothing here calls React
- src/hooks — React hooks only: usePeerRoom (wires the protocol to React), useLocalGame, useGameStats, usePlayerCount, useAppTheme
- src/lib/matchmaking.ts — relay URL acquisition and the quick-match queue client
- src/lib/roomClient.ts + roomId.ts — room socket wrapper and room id helpers (`generateRoomId`, `ROOM_ID_PATTERN`)
- src/lib/identity.ts — generated guest identity, localStorage-backed
- src/lib/storage.ts — the one browser-storage guard (SSR and private-mode safe)
- src/components — game board and lobby surfaces
- src/components/backgroundField.ts — the heat-field model for `BackgroundPattern`; the one pure module kept beside its single consumer
- src/components/game/queuePlay.tsx — play the computer while a quick-match search runs or a created room waits (invite, wait strip, warm-up game, opponent-found handoff); shares `LocalBoard` and `useRecordLocalResult` with the local surface
- src/lib/room-protocol/waitPhase.ts — pure derivation of the wait phase (`searching | matched | ended | null`) for Quick (from `PeerRoomState.queue`) and a created room (from its connection states)
- e2e/ — Playwright smoke tests
- deploy — `wrangler pages deploy dist` (Cloudflare Pages)
- fuurma-matchmaking (separate Worker) — pairing + GameRoomDO relay; not in this repo
