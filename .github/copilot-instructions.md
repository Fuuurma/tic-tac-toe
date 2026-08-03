# Copilot Instructions for TicTacToe

This repository is a single Vite + React + TypeScript application for a
3-piece strategic tic-tac-toe game. There is no Next.js, no Socket.IO
server, and no React Native subproject under this repository.

## Project Structure

This repo is one Vite SPA. There is no `/TicTacToeMobile` subproject
in this checkout; if you see references to it, they refer to a
separate parked experiment.

```
src/game/               pure rules, AI search, shared constants
src/hooks/              useLocalGame, usePeerRoom, useGameStats
src/components/auth/    login form, mark/symbol pickers
src/components/game/    board, board cell, panels, online surface
src/lib/                peer protocol validation, RoomClient, identity, matchmaking
e2e/                    Playwright smoke (smoke + quick-match)
public/                 static assets served by Cloudflare Pages
wrangler.jsonc          Cloudflare Pages config (no Worker, no DO bindings)
```

## Core Game Concept

- **Board**: 3x3 grid
- **3-Piece Rule**: Each player can have at most 3 pieces; placing a
  4th removes the oldest mark.
- **Turn Timer**: 10 seconds per turn; on timeout a random legal
  move is played.
- **Win Condition**: 3 in a row (row, column, or diagonal).
- **Result**: The 3-piece variant rarely draws; outcomes are
  win-for-X, win-for-O, or stalemate.

## Build, Test, and Lint Commands

All commands run from the repository root unless noted:

```bash
pnpm install                  # Use pnpm 10.30.2 unless stated otherwise
pnpm dev                      # Vite dev server at http://127.0.0.1:3110
pnpm build                    # tsc -b && vite build, output to dist/
pnpm preview                  # vite preview at http://127.0.0.1:4110
pnpm lint                     # ESLint over src, e2e, vite, vitest, playwright configs
pnpm test                     # vitest run (unit)
pnpm test:e2e                 # pnpm build && playwright test
pnpm check                    # pnpm lint && pnpm test && pnpm test:e2e
pnpm deploy:check             # build + sanity-check the dist artifact
pnpm deploy                   # pnpm build && wrangler pages deploy dist
```

## Stack

- **Shell**: Vite 8 + React 19 + TypeScript + Tailwind v4
- **Realtime**: Cloudflare Durable Object WebSocket relay inside the
  shared `fuurma-matchmaking` Worker — there is no Socket.IO server
  in this repo.
- **Backend**: The shared `fuurma-matchmaking` Cloudflare Worker
  provides `/api/matchmaking/{game}` quick-match endpoints and a
  per-room `GameRoomDO` WebSocket relay.
- **Auth**: None (guest-only; a `guestId` is generated in
  `src/lib/identity.ts` and persisted to `localStorage`).
- **Deploy**: Cloudflare Pages static (`dist/`).
- **Testing**: Vitest (unit) + Playwright (smoke).
- **AI**: Easy = random with a center/corner/edge preference,
  Normal = depth-4 alpha-beta with depth-bounded eval,
  Hard = depth-8 alpha-beta with similar eval.
  Hard and Normal can exceed the mobile 100ms move-time budget;
  a Web Worker offload is the documented mitigation.

## Online Play Architecture

- **Host** = the player who creates the room. The host's symbol (X
  or O) is randomized at room creation and again on each rematch.
- **Guest** = the joining player; gets the opposite symbol.
- **Reliability**: The host is authoritative for game state and
  the timer. Guest moves are validated on the host and broadcast
  back to the guest via `gameUpdate`.
- **Reconnect**: 30-second grace after `peer-left: disconnect`.
  `peer-reconnected` restores the slot; `closed`/`expired` are
  terminal. The host resets `turnTimeRemaining` to the full
  duration after a reconnect, so the very next tick cannot force
  a random fallback.
- **Rematch**: `rematchAccept` is gated by the host side on
  (a) a pending host-issued rematch request and (b) the previous
  game being terminal. Without either, the host ignores the
  guest's accept, preventing a mid-game reset by a hostile peer.
- **Quick match** uses `POST /api/matchmaking/tictactoe/join` on
  the shared Worker. The matchmaking response carries either a
  `waiting` ticket (host path) or a `matched` payload (guest
  path).

## Wire Schema

Wire messages are validated by `isPeerMessage` in
`src/lib/peer.ts`. The validator rejects:

- Display names/guest IDs outside 1..20 / 1..64 character bounds.
- `preferredColor` that is not a member of the `Color` enum.
- Move indices outside `0..BOARD_SIZE - 1` or that are not integers.
- `winningCombination` that does not match one of the eight
  canonical WINNING_COMBINATIONS rows.
- `turnTimeRemaining` outside `0..TURN_DURATION_MS`.
- `gameMode`/`gameStatus`/`aiDifficulty`/`PlayerType` values
  outside their enums.
- Moves.X/O arrays longer than `MAX_MOVES_PER_PLAYER` or with
  out-of-range indices.
- `nextToRemove` values outside the board range.
- `maxMoves` outside the configured rule range.

A relay peer cannot mutate guest state via oversized or spoofed
frames. Rejecting those frames is part of the contract.

## Code Style

- Functional components with hooks, no `"use client"` (Vite SPA).
- Use `cn()` from `@/lib/utils` for className merging.
- Use `useCallback`/`useMemo` for event handlers and expensive
  computations.
- Pure game logic in `src/game/` must not import React.
- Game message types are a discriminated union in `src/lib/peer.ts`
  (the filename is historical; the transport is the WebSocket
  relay, never PeerJS or Socket.IO).
- Validate wire state before writing it to React state, even though
  the host is intended to be authoritative — a hostile relay peer
  can still spoof frames.

## Key Constants

- `TURN_DURATION_MS = 10_000` (10s per turn).
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3`.
- `BOARD_SIZE = 9`.
- AI difficulties: `EASY`, `NORMAL`, `HARD` (no `INSANE`).
- `AI_MOVE_DELAY_MS = 700` (intentional pre-move thinking delay,
  with up to `AI_MOVE_DELAY_JITTER_MS = 600` additional jitter).
- `GAME_ID = "tictactoe"` (the wire id used by the matchmaking
  Worker).

## Environment Variables

- `VITE_MATCHMAKING_URL` — the base URL for
  `/api/matchmaking/tictactoe` and `/room/{roomId}`. Used by
  `src/lib/matchmaking.ts` and `src/hooks/usePeerRoom.ts`.
- The historical `VITE_USE_WS_ROOM` flag was removed; the
  client always uses WebSockets and never falls back to a
  non-WebSocket transport.

## Common Workflows

### Adding a new wire field

1. Extend `GameState` in `src/game/logic.ts` (or `PeerMessage`
   in `src/lib/peer.ts` for top-level messages).
2. Update `isGameState`/`isPeerMessage` in `src/lib/peer.ts`
   to validate the new field, including hostile frames.
3. Add a focused regression test in `src/lib/peer.hostile.test.ts`.

### Adding a new AI difficulty

1. Add the constant to `AI_Difficulty` in
   `src/game/constants.ts`.
2. Hook it into `getAIMove` in `src/game/ai.ts`.
3. If the new difficulty crosses the mobile 100ms budget, route
   it through the AI Web Worker.

## Important Notes

1. **TypeScript**: Strict mode. Imports follow the order
   external libs → internal types/utils → components.
2. **Immutable state**: Never mutate state directly; spread into
   a new object or use `setState`/`commitHostState`.
3. **Performance**: Hard AI can blow the 100ms budget; see the
   audit for the proposed Worker offload.
4. **Game logic and AI are unit-tested**: at least one Vitest
   suite covers each rule and each AI difficulty.
5. **Don't assume Next.js, Socket.IO, or a React Native
   subproject** — none of those exist in this repo.
