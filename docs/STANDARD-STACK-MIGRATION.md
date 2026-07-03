# Standard Stack Migration

Source plan: `/Users/sergi/Projects/newProjectsPlanner/migrations/2026-07-games-standard-stack-migration.md`

## Current Baseline

- Next.js 16 custom server with Socket.IO online play.
- React 19, TypeScript, Tailwind v4, Radix/shadcn UI.
- AI/local/online/rematch flows are covered by Playwright smoke tests.
- Socket.IO server and integration tests share `socketGameCore.js`.
- Railway/Docker deploy config exists, with `/healthz` for deployment checks.
- Public WebSocket deploy smoke is still pending.

## Migration Rules

- Do not break current local, AI, or online play while migrating.
- Keep game rules framework-independent and serializable.
- Keep Socket.IO until Convex turn sync has parity and two-browser smoke passes.
- Add libraries only with one real usage.
- Do not claim the public demo is live until the deployed URL is smoked.

## Phase 0 Tasks

- [x] Create migration branch.
- [x] Add Motion with one visible usage in the current app.
- [x] Create initial `src/game/core` facade for state/rules/AI/selectors/validation.
- [x] Point first local rule tests at `src/game/core`.
- [x] Align package manager to pnpm 11.9.0.
- [x] Add `ts-pattern` with real game-mode/action/AI routing usages.
- [x] Add guest identity helper with generated `guestId`, display-name persistence, and legacy username migration.
- [x] Move Socket.IO login toward object payloads while keeping positional login compatibility.
- [ ] Finish/smoke current WebSocket deploy on a public URL.
- [ ] Keep unit, integration, build, and Playwright checks green.

## Phase 1 Convex Profile Foundation

- [x] Add `convex` dependency and setup scripts.
- [x] Add schema for profiles, claims, rooms, room players, moves, matches, stats, and invites.
- [x] Add guest profile upsert/get/update/claim functions.
- [x] Add match result recording and stats query functions.
- [x] Add durable Convex room, invite, player, and move functions.
- [x] Add durable Convex match history queries.
- [ ] Configure a real Convex deployment with `pnpm convex:dev`.
- [ ] Regenerate `convex/_generated/` from the configured deployment. Current `pnpm convex:codegen` is blocked until `CONVEX_DEPLOYMENT` exists.
- [x] Wire app startup to upsert guest profiles when `NEXT_PUBLIC_CONVEX_URL` is configured.
- [x] Record completed Socket.IO matches into Convex when both players have identity metadata.
- [x] Hydrate sidebar stats from Convex when `NEXT_PUBLIC_CONVEX_URL` is configured.
- [x] Bridge Socket.IO rooms, players, leaves, status changes, and moves to Convex when `CONVEX_URL` or `NEXT_PUBLIC_CONVEX_URL` is configured.
- [x] Harden optional OAuth claim logic: idempotent guest claims, conflicting-claim protection, and guest stat merge into account profiles.
- [x] Add client account identity helper for future Better Auth session wiring.
- [ ] Add Better Auth + Google UI after deployment callbacks and provider envs are configured.

## Core Extraction Boundary

Initial folder now exists:

```txt
src/game/core/
  actions.ts
  ai.ts
  index.ts
  reducer.ts
  rules.ts
  selectors.ts
  state.ts
  validation.ts
```

Current files to extract or adapt:

- Rules and constants:
  - `app/game/constants/constants.ts`
  - `app/game/logic/checkWinner.ts`
  - `app/game/logic/getValidMoves.ts`
  - `app/game/logic/isGameActive.ts`
  - `app/game/logic/isValidMove.ts`
  - `app/game/logic/makeMove.ts`
  - `app/game/logic/makeRandomMove.ts`
  - `app/game/logic/newGameState.ts`
- AI:
  - `app/game/ai/AI_MoveEngine.ts`
  - `app/game/ai/getAI_Move.ts`
  - `app/game/ai/handleAI_Move.ts`
  - `app/game/ai/MiniMaxAlgorithm/`
  - `app/game/ai/MonteCarloTS/`
  - `app/game/ai/simpleAI/`
- Online adapter:
  - `socketGameCore.js`
  - `server.js`
  - `app/hooks/game/useSocketGame.ts`
  - `tests/helpers/testServer.js`
- Identity:
  - `app/utils/identity/gameIdentity.ts`
  - `app/page.tsx`
  - future Convex/Better Auth profile claim helpers
- Convex profile/stats foundation:
  - `convex/schema.ts`
  - `convex/profiles.ts`
  - `convex/stats.ts`
  - `convex/model.ts`
- UI adapters that should consume core selectors later:
  - `app/hooks/game/useLocalGame.ts`
  - `app/hooks/game/useGameTimer.ts`
  - `components/game/board.tsx`
  - `components/game/boardCell.tsx`
  - `components/game/playersPanel.tsx`

## Next Extraction Step

Keep migrating adapter-facing imports to `src/game/core`:

1. `app/hooks/game/useLocalGame.ts`
2. `app/hooks/game/useSocketGame.ts`
3. `socketGameCore.js` / `server.js` shared logic
4. AI callers under `app/hooks/game`

Progress:

- [x] `app/hooks/game/useLocalGame.ts` imports rules/state/AI through `src/game/core`.
- [x] `app/hooks/game/useGameTimer.ts` imports rules/state/AI through `src/game/core`.
- [x] `app/hooks/game/useSocketGame.ts` imports game/socket types and online status selectors through `src/game/core`.
- [x] Added `src/game/core/online.ts` selectors for Socket.IO status snapshots and messages.
- [x] Centralized Socket.IO room resets so reset/rematch/leave flows preserve identity metadata.
- [ ] Move shared `socketGameCore.js` rules behind the TypeScript core boundary.

Keep the current app imports working through compatibility re-exports until the
UI and Socket.IO adapter are migrated.

The repo now declares `packageManager: pnpm@11.9.0`, matching the local v11 store
used by this checkout. Use pnpm 11 for future dependency changes.

## Later Phases

- Add Convex for durable guest profiles, rooms, moves, matches, and stats.
- Record completed Socket.IO matches into Convex before replacing live turns.
- Build a TanStack Start shell after the extracted core is stable.
- Decide whether Convex replaces Socket.IO only after create/join/complete/rematch/reload smoke passes.
- Revisit Capacitor vs Expo after the public web game and mobile web smoke are proven.
