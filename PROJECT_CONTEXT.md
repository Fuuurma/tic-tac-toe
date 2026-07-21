# TicTacToe - Project Context

**Project Type:** Static Web Game
**Status:** Guest-first public preview; codebase hardened via multi-round audit
**Last Updated:** July 21, 2026

---

## Project Overview

Tic Tac Toe implementation featuring a strategic three-piece variant. The
active application is a Vite 5 + React SPA with client-side AI and a shared
Cloudflare Durable Object WebSocket relay.

---

## Tech Stack

### Frontend
- **Framework:** Vite 5, React 19
- **Styling:** Tailwind CSS 4+
- **State Management:** Custom specialized hooks

### Realtime and deployment
- **Real-time:** shared Worker WebSocket relay; host-authoritative game state
- **Deployment:** Cloudflare Pages static output from `dist/`

---

## Key Features

- **3-Piece Strategic Variant**: Dynamic piece removal; max 3 pieces per player, oldest auto-removed on 4th.
- **Multiplayer**: Online and local VS modes.
- **Host-authoritative timers**: The room host applies and broadcasts timeouts.
- **AI Opponents**: Easy (random), Normal (heuristic), Hard (minimax), Insane (MCTS).
- **Minimal Auth**: Anonymous guest play with localStorage persistence.
- **Real-time Stats**: Streak and win rate tracking.

---

## Development Commands

```bash
pnpm dev              # Development (port 3110)
pnpm build            # Production build (tsc -b && vite build)
pnpm preview          # Preview production build (port 4110)
pnpm lint             # ESLint
pnpm test             # Vitest unit tests
pnpm test:e2e         # Playwright E2E (requires build first)
pnpm check            # Lint + test + E2E
```

## Deploy Notes

- Cloudflare Pages build command: `pnpm build`; output: `dist`.
- Public preview is not production-ready until the current Worker and client
  changes are deployed and a two-network online match, reconnect, rematch, and
  expiry pass succeeds.

---

## AI Agent Rules

1. **Maintain Hook Separation**: Keep game logic in `src/game/` and hooks in `src/hooks/`.
2. **Mobile First**: Ensure all UI changes are touch-friendly and fit `100dvh`.
3. **Pure Logic**: Keep `src/game/` functions pure and independently tested.
4. **Immutability**: Never mutate game state objects directly — always spread/clone.
5. **WebSocket Safety**: All WS operations use optional chaining; room null checks before send.
