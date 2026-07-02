# TicTacToe - Project Context

**Project Type:** Multi-platform Web/Mobile Game
**Status:** Web demo deploy-ready; public URL smoke pending
**Last Updated:** July 2, 2026

---

## Project Overview

High-performance TicTacToe implementation featuring a strategic 3-piece variant. Consolidated into a single Next.js + Capacitor codebase for seamless web and native mobile deployment.

---

## Tech Stack

### Unified Frontend
- **Framework:** Next.js 16, React 19
- **Mobile:** Capacitor 8+ (iOS/Android)
- **Styling:** Tailwind CSS 4+
- **State Management:** Custom specialized hooks

### Backend
- **Real-time:** Socket.IO integrated via `server.js`
- **Deployment:** Docker-backed Railway config with `/healthz` healthcheck

---

## Key Features

- **3-Piece Strategic Variant**: Dynamic piece removal.
- **Multiplayer**: Online and local VS modes.
- **Server-authoritative timers**: Online matches use server ticks and timeout moves.
- **AI Opponents**: MCTS and Minimax difficulty levels.
- **Minimal Auth**: Anonymous guest play with persistence.
- **Real-time Stats**: Streak and win rate tracking.

---

## Development Commands

```bash
pnpm dev              # Development
pnpm build            # Production build
pnpm start:prod       # Full server (Next + Socket.IO)
pnpm cap:sync         # Mobile sync
```

## Deploy Notes

- `railway.json` uses the Dockerfile builder and `/healthz` for healthchecks.
- The custom server must run as a long-lived Node process because online mode depends on Socket.IO WebSockets.
- `NEXT_PUBLIC_SOCKET_URL` should stay unset when web and Socket.IO share the same origin.
- Public demo is not complete until a deployed two-browser online match and rematch pass.

---

## AI Agent Rules

1. **Maintain Hook Separation**: Keep game logic in `app/hooks/game/`.
2. **Mobile First**: Ensure all UI changes are touch-friendly and fit `100dvh`.
3. **Pure Logic**: Keep `app/game/logic/` functions pure and synchronized with `server.js`.
