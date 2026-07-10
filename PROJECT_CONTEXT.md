# TicTacToe - Project Context

**Project Type:** Static Web Game
**Status:** Local production checks pass; public URL smoke pending
**Last Updated:** July 10, 2026

---

## Project Overview

Tic Tac Toe implementation featuring a strategic three-piece variant. The
active application is a Vite + React SPA with client-side AI and PeerJS P2P.

---

## Tech Stack

### Frontend
- **Framework:** Vite 5, React 19
- **Styling:** Tailwind CSS 4+
- **State Management:** Custom specialized hooks

### Realtime and deployment
- **Real-time:** PeerJS data channels; host-authoritative game state
- **Deployment:** Cloudflare Pages static output from `dist/`

---

## Key Features

- **3-Piece Strategic Variant**: Dynamic piece removal.
- **Multiplayer**: Online and local VS modes.
- **Host-authoritative timers**: The room host applies and broadcasts timeouts.
- **AI Opponents**: MCTS and Minimax difficulty levels.
- **Minimal Auth**: Anonymous guest play with persistence.
- **Real-time Stats**: Streak and win rate tracking.

---

## Development Commands

```bash
pnpm dev              # Development
pnpm build            # Production build
pnpm check            # Lint, unit tests, build, browser smoke
```

## Deploy Notes

- Cloudflare Pages build command: `pnpm build`; output: `dist`.
- PeerJS Cloud is currently used for signaling.
- Public demo is not complete until a deployed two-network online match and
  rematch pass. Broad launch additionally requires a TURN/signaling plan.

---

## AI Agent Rules

1. **Maintain Hook Separation**: Keep game logic in `src/game/` and hooks in `src/hooks/`.
2. **Mobile First**: Ensure all UI changes are touch-friendly and fit `100dvh`.
3. **Pure Logic**: Keep `src/game/` functions pure and independently tested.
