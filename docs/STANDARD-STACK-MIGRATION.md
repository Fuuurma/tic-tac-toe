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
- [ ] Finish/smoke current WebSocket deploy on a public URL.
- [ ] Keep unit, integration, build, and Playwright checks green.
- [ ] Add `ts-pattern` once pnpm store mismatch is settled.

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

Keep the current app imports working through compatibility re-exports until the
UI and Socket.IO adapter are migrated.

`ts-pattern` is still intended for game-mode/AI difficulty unions, but adding it
is currently blocked by local pnpm store drift: this checkout's `node_modules`
is linked from `/Users/sergi/Library/pnpm/store/v11`, while repo pnpm 10 wants
`/Users/sergi/Library/pnpm/store/v10`. Avoid a broad reinstall in the middle of
feature work; settle package manager/store state first.

## Later Phases

- Add Convex for durable guest profiles, rooms, moves, matches, and stats.
- Record completed Socket.IO matches into Convex before replacing live turns.
- Build a TanStack Start shell after the extracted core is stable.
- Decide whether Convex replaces Socket.IO only after create/join/complete/rematch/reload smoke passes.
- Revisit Capacitor vs Expo after the public web game and mobile web smoke are proven.
