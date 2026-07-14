<!-- fuurma-hub-start -->
## Fuurma Hub Context

This repo is one project inside the Fuurma portfolio workspace. The planner hub is the source of truth for cross-project priorities, reusable stack decisions, ports, deploy/auth notes, and agent handoffs.

Before meaningful work, read:
1. Current sprint / next work: `/Users/sergi/Projects/newProjectsPlanner/WORK.md`
2. This project's state page: `/Users/sergi/Projects/newProjectsPlanner/projects/tic-tac-toe.md`
3. Standard stack playbook: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/STACK-STANDARDS.md`
4. Agent skills/context: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/AGENT-CONTEXT.md`
5. Official docs index: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/OFFICIAL-DOCS.md`

Use the deeper hub docs when relevant:
- Auth/OAuth: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/AUTH-OAUTH.md`
- Forms: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/TANSTACK-FORM.md`
- Deploy/launch: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/SHIP-KIT.md`
- Ports: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/PORTS.md`
- Secrets/accounts: `/Users/sergi/Projects/newProjectsPlanner/tech-stack/ACCOUNTS-SECRETS.md`

Operational rules:
- Run `git status --short --branch` before editing and protect dirty user/agent work.
- Product repo code/tests are the immediate truth; when they disagree with the hub, update the hub after verifying.
- After reading the hub pointers, keep reading this file's repo-local instructions; they are the authority for this codebase.
- Use `pnpm@10.30.2` unless this repo explicitly documents a different toolchain.
- When you learn a reusable pattern, fix, or project-state change, update `/Users/sergi/Projects/newProjectsPlanner` so the next agent starts stronger.
<!-- fuurma-hub-end -->


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
  - `src/lib/` — utilities (identity helper, WebSocket/PeerJS protocol, cn())
  - `src/types.ts` — (currently in logic.ts and constants.ts)
- `e2e/` — Playwright smoke tests
- `public/` — static assets and `_headers` (CF Pages)
- `wrangler.jsonc` — Cloudflare Pages config

## Stack

- **Shell**: Vite 5 + React 19 + TypeScript + Tailwind v4
- **Realtime**: Cloudflare Durable Object WebSocket relay inside the shared `fuurma-matchmaking` Worker (default `VITE_USE_WS_ROOM=true`; PeerJS fallback still present)
- **Backend**: Shared `fuurma-matchmaking` Cloudflare Worker for quick match pairing and `GameRoomDO` WebSocket relay
- **Auth**: None (guest-only)
- **Deploy**: Cloudflare Pages (static, `dist/`)
- **Testing**: Vitest (unit) + Playwright (smoke)
- **AI**: Minimax + MCTS (client-side)

## Code Style

- Functional components with hooks, `"use client"` not needed (Vite SPA)
- Use `cn()` from `@/lib/utils` for className merging
- Use `useCallback`/`useMemo` for event handlers and expensive computations
- Pure game logic in `src/game/` must not import React
- Network message types are a discriminated union in `src/lib/peer.ts` (used by WebSocket and PeerJS transports)

## Game Rules

- 3-piece strategic variant: max 3 pieces per player, oldest auto-removed on 4th
- 10s turn timer; on timeout, random legal move
- Win detection: 3 in a row/column/diagonal

## Online multiplayer

- Default transport is the shared `fuurma-matchmaking` Cloudflare Durable Object WebSocket relay (`VITE_USE_WS_ROOM=true` in `.env.production`)
- Room creator = host = player X, owns game state and timer
- Guest = player O, sends move intents to host
- Host validates, applies, and broadcasts state to guest
- PeerJS fallback is still present but scheduled for removal after one week green

## Key Constants

- `TURN_DURATION_MS = 10_000` (10s per turn)
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3`
- `BOARD_SIZE = 9`
- AI difficulties: EASY (random), NORMAL (heuristic), HARD (minimax), INSANE (MCTS)
