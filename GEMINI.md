# TicTacToe Project Guide

This document provides foundational mandates and essential context for AI agents working on the TicTacToe project.

## Project Overview

TicTacToe is a multi-platform game implementation with a unique **3-piece strategic variant**: each player can have a maximum of 3 pieces on the board; placing a 4th piece automatically removes their oldest one. This variant keeps the board moving until someone wins and ensures fast-paced gameplay.

### Core Architecture
- **Unified App:** Next.js 15+ application using the App Router.
- **Multi-Platform:** Deployed as a Web App and a Native Mobile App (iOS/Android) via **Capacitor 8+**.
- **Multiplayer Backend:** A custom Socket.IO server integrated via `server.js`.
- **Logic Design:** Core state and effects are managed via specialized hooks in `app/hooks/game/`.

---

## Tech Stack

- **Framework:** Next.js 15+, React 19, TypeScript
- **Styling:** Tailwind CSS 4+, Radix UI, shadcn/ui
- **Mobile Bridge:** Capacitor 8+
- **Real-time:** Socket.IO 4+
- **Testing:** Vitest

---

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server (with Turbopack)
pnpm build            # Production build
pnpm start:prod       # Start production server with Socket.IO (server.js)
pnpm lint             # Run ESLint
pnpm test:unit        # Run unit tests only
pnpm cap:sync         # Sync web build to Capacitor (ios/android)
```

---

## Development Conventions

### Coding Style
- **Hooks-First:** Game logic must reside in `app/hooks/game/` (e.g., `useSocketGame`, `useLocalGame`).
- **Functional Components:** Always use functional components with React Hooks.
- **TypeScript:** Strict mode is mandatory. Define types in `app/types/types.ts`.
- **Imports:** Group imports (React/Libraries first, then Internal, then Components).

### Project Structure
- `app/game/logic/`: Pure functions for game rules (move validation, win checking).
- `app/game/ai/`: AI algorithm implementations (MCTS, Minimax).
- `app/hooks/game/`: Centralized game state and side-effect management.
- `components/`: UI components organized by feature (game, auth, menu, ui).

### Testing Mandates
- **Empirical Validation:** For bug fixes, always reproduce the issue with a test case first.
- **Test Files:** Located in `tests/`.
- **Tooling:** Use `vitest`.

### Authentication
- **Anonymous Guest Auth:** Minimal anonymous authentication. Usernames are persisted in `localStorage`.
- **Guest Play:** Supports instant entry via auto-generated guest names.

---

## Key Game Rules (3-Piece Variant)
1. **Max Pieces:** 3 per player.
2. **Auto-Removal:** When a player makes their 4th move, their 1st move is removed from the board.
3. **Turn Timer:** 10 seconds per turn. A random move is automatically triggered on timeout.
4. **Victory:** 3 in a row (horizontal, vertical, or diagonal).
