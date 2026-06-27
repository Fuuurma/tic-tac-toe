# TicTacToe - Project Context

**Project Type:** Multi-platform Web/Mobile Game
**Status:** Consolidated & Optimized
**Last Updated:** April 4, 2026

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
- **Deployment:** Optimized for Railway (Next.js + Socket.IO)

---

## Key Features

- **3-Piece Strategic Variant**: Dynamic piece removal.
- **Multiplayer**: Online and local VS modes.
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

---

## AI Agent Rules

1. **Maintain Hook Separation**: Keep game logic in `app/hooks/game/`.
2. **Mobile First**: Ensure all UI changes are touch-friendly and fit `100dvh`.
3. **Pure Logic**: Keep `app/game/logic/` functions pure and synchronized with `server.js`.
