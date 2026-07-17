<!-- fuurma-hub-start -->
## Fuurma Hub Context

This repo is one project inside the Fuurma portfolio workspace. The planner hub
is the source of truth for cross-project priorities, reusable stack decisions,
ports, deploy/auth notes, and agent handoffs.

Before meaningful work, read:
1. Current sprint / next work: `~/Projects/newProjectsPlanner/WORK.md`
2. This project's state page: `~/Projects/newProjectsPlanner/projects/tic-tac-toe.md`
3. Standard stack playbook: `~/Projects/newProjectsPlanner/tech-stack/STACK-STANDARDS.md`
4. Agent skills/context: `~/Projects/newProjectsPlanner/tech-stack/AGENT-CONTEXT.md`
5. Official docs index: `~/Projects/newProjectsPlanner/tech-stack/OFFICIAL-DOCS.md`

Use the deeper hub docs when relevant:
- Auth/OAuth: `~/Projects/newProjectsPlanner/tech-stack/AUTH-OAUTH.md`
- Forms: `~/Projects/newProjectsPlanner/tech-stack/TANSTACK-FORM.md`
- Deploy/launch: `~/Projects/newProjectsPlanner/tech-stack/SHIP-KIT.md`
- Ports: `~/Projects/newProjectsPlanner/tech-stack/PORTS.md`
- Secrets/accounts: `~/Projects/newProjectsPlanner/tech-stack/ACCOUNTS-SECRETS.md`

Operational rules:
- Run `git status --short --branch` before editing and protect dirty user/agent work.
- Product repo code/tests are the immediate truth; when they disagree with the hub, update the hub after verifying.
- After reading the hub pointers, keep reading this file's repo-local instructions; they are the authority for this codebase.
- Use `pnpm@10.30.2` unless this repo explicitly documents a different toolchain.
- When you learn a reusable pattern, fix, or project-state change, update `~/Projects/newProjectsPlanner` so the next agent starts stronger.

### Agent skills and generated guidance

When one of these global skills matches your work, **invoke it immediately** at the start of the session:
- `shadcn` — adding, fixing, or reviewing shadcn/ui components and Tailwind v4 styling.
- `convex` — routing Convex work to the right helper skill (quickstart, auth, components, migrations, performance audit).
- `stripe-best-practices` — checkout, billing, subscriptions, webhooks, Connect, key handling.
- `workers-best-practices` / `durable-objects` / `cloudflare` — Cloudflare Workers, Wrangler, bindings, Durable Objects, Agents SDK.
- `cloudflare-email-service` / `turnstile-spin` — when adding those services.
- `convex-setup-auth`, `convex-create-component`, `convex-migration-helper`, `convex-performance-audit` — repo-local Convex skills when present.

For Convex repos, run `npx convex ai-files install` first if `convex/_generated/ai/guidelines.md` is missing or stale.

For UI work, use `pnpm dlx shadcn@latest` and follow the `shadcn` skill rules (no `space-x/y`, use `gap-*`, `size-*`, `cn()`, semantic tokens, lucide icons, `FieldGroup`/`Field`, etc.).

For TanStack Start/Router/Form, there is no global skill; follow `STACK-STANDARDS.md`, `CONVENTIONS.md`, and `TANSTACK-FORM.md`. Use TanStack Form for every new form and every touched legacy form.

For Better Auth, follow `AUTH-OAUTH.md` exactly.
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
  - `src/lib/` — utilities (identity helper, WebSocket protocol, cn())
  - `src/types.ts` — (currently in logic.ts and constants.ts)
- `e2e/` — Playwright smoke tests
- `public/` — static assets and `_headers` (CF Pages)
- `wrangler.jsonc` — Cloudflare Pages config

## Stack

- **Shell**: Vite 5 + React 19 + TypeScript + Tailwind v4
- **Realtime**: Cloudflare Durable Object WebSocket relay inside the shared `fuurma-matchmaking` Worker (PeerJS fallback removed; `VITE_USE_WS_ROOM` remains in `.env.production` as a one-week rollback flag)
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
- Network message types are a discriminated union in `src/lib/peer.ts` (used by the WebSocket relay)

## Game Rules

- 3-piece strategic variant: max 3 pieces per player, oldest auto-removed on 4th
- 10s turn timer; on timeout, random legal move
- Win detection: 3 in a row/column/diagonal

## WebSocket Relay Model

- Default transport is the shared `fuurma-matchmaking` Cloudflare Durable Object WebSocket relay
- `VITE_USE_WS_ROOM=true` is still set in `.env.production` as a one-week rollback flag, but the code always uses WebSocket
- Room creator = host = player X, owns game state and timer
- Guest = player O, sends move intents to host
- Host validates, applies, and broadcasts state to guest
- PeerJS fallback removed

## Key Constants

- `TURN_DURATION_MS = 10_000` (10s per turn)
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3`
- `BOARD_SIZE = 9`
- AI difficulties: EASY (random), NORMAL (heuristic), HARD (minimax), INSANE (MCTS)
