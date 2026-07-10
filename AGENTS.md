# AGENTS.md

Guidelines for agentic coding tools working on this TicTacToe project.

## Development Commands

```bash
# Install dependencies
pnpm install

# Dev server
pnpm dev

# Build (type-check + Vite)
pnpm build

# Preview production build locally
pnpm preview

# Lint
pnpm lint

# Unit tests
pnpm test

# Playwright smoke (local: runs against pnpm preview)
pnpm test:e2e

# Playwright smoke (deployed: against the real URL)
E2E_BASE_URL=https://<your-url> pnpm test:e2e

# Full local production gate
pnpm check
```

## Project Structure

- `src/` — Vite + React application
  - `src/game/` — pure game domain (rules, AI, constants)
  - `src/hooks/` — React hooks (usePeerRoom, useLocalGame, useGameStats)
  - `src/components/` — UI (board, login, panels, selectors, confirm dialog)
  - `src/lib/` — utilities (identity helper, PeerJS protocol, cn())
  - `src/types.ts` — (currently in logic.ts and constants.ts)
- `e2e/` — Playwright smoke tests
- `public/` — static assets and `_headers` (CF Pages)
- `wrangler.jsonc` — Cloudflare Pages config

## Stack

- **Shell**: Vite 5 + React 19 + TypeScript + Tailwind v4
- **Realtime**: PeerJS (P2P via data channels)
- **Backend**: Shared `fuurma-matchmaking` Cloudflare Worker for quick match pairing (room creation/joining is still P2P)
- **Auth**: None (guest-only)
- **Deploy**: Cloudflare Pages (static, `dist/`)
- **Testing**: Vitest (unit) + Playwright (smoke)
- **AI**: Minimax + MCTS (client-side)

## Code Style

- Functional components with hooks, `"use client"` not needed (Vite SPA)
- Use `cn()` from `@/lib/utils` for className merging
- Use `useCallback`/`useMemo` for event handlers and expensive computations
- Pure game logic in `src/game/` must not import React
- PeerJS message types are a discriminated union in `src/lib/peer.ts`

## Game Rules

- 3-piece strategic variant: max 3 pieces per player, oldest auto-removed on 4th
- 10s turn timer; on timeout, random legal move
- Win detection: 3 in a row/column/diagonal

## PeerJS P2P Model

- Room creator = host = player X, owns game state and timer
- Guest = player O, sends move intents to host
- Host validates, applies, and broadcasts state to guest
- Signaling via PeerJS public broker (or self-hosted)
- Production launch needs a deliberate PeerServer and TURN reliability plan

## Key Constants

- `TURN_DURATION_MS = 10_000` (10s per turn)
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3`
- `BOARD_SIZE = 9`
- AI difficulties: EASY (random), NORMAL (heuristic), HARD (minimax), INSANE (MCTS)
