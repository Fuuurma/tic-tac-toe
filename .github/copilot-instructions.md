# Copilot Instructions for TicTacToe

This project is a multi-platform TicTacToe game with a unique **3-piece strategic variant**. Use this guide to understand the architecture, development workflow, and key conventions.

## Project Structure

The repository contains two distinct applications:

- **`/tic-tac-toe`** (Primary): Next.js 15 web/hybrid app with Socket.IO multiplayer backend
- **`/TicTacToeMobile`** (Secondary): React Native 0.84 app for native iOS/Android

**Unless specified otherwise, work in `/tic-tac-toe`.**

## Core Game Concept

- **Board**: 3x3 grid
- **3-Piece Rule**: Each player can have max 3 pieces; placing a 4th removes the oldest
- **Turn Timer**: 10 seconds per turn; timeout triggers random move
- **Win Condition**: 3 in a row (horizontal, vertical, diagonal)
- **Result**: No draws possible due to piece removal mechanism

## Build, Test, and Lint Commands

All commands run from `/tic-tac-toe` unless noted:

### Development & Build

```bash
pnpm dev              # Start dev server with Turbopack (port 3000)
pnpm build            # Production build
pnpm start            # Run next start (production)
pnpm start:prod       # Run custom server with Socket.IO (port 3000 + 3009)
```

### Testing

```bash
pnpm test             # Run all tests (vitest)
pnpm test -- tests/unit/checkWinner.test.ts      # Single test file
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests only
pnpm test:load        # Load tests only
pnpm test:watch       # Watch mode
pnpm test:ui          # UI dashboard for tests
pnpm test:coverage    # Coverage report
```

### Linting & Formatting

```bash
pnpm lint             # Run ESLint (Next.js + TypeScript)
```

## High-Level Architecture

### Web App (`/tic-tac-toe`)

**Framework**: Next.js 15 (App Router), React 19, TypeScript strict mode

**Key Directories**:
- `app/` - Page routes and core logic
  - `game/logic/` - Pure functions for game rules (move validation, win detection, piece tracking)
  - `game/ai/` - AI implementations (MCTS, Minimax, Simple)
  - `game/constants/` - Enums, constants, game rules
  - `types/` - Centralized TypeScript definitions
  - `utils/` - Utility functions
  - `hooks/` - Custom hooks (game state, Socket.IO, analytics)
  - `api/` - Socket connection helpers
- `components/` - React components by feature
  - `ui/` - shadcn/ui reusable primitives
  - `game/` - Game-specific components (board, panels)
  - `auth/` - Authentication forms
  - `menu/` - Menus and theme toggle
- `server.js` - Custom Socket.IO server (for `pnpm start:prod`)
- `tests/` - Test files (unit, integration, load)

**Styling**: Tailwind CSS 4 + Radix UI + shadcn/ui with dark mode support

**Real-time**: Socket.IO 4 for multiplayer (server runs on port 3009)

### Native App (`/TicTacToeMobile`)

React Native 0.84 with TypeScript. Same game logic as web. Primary web app handles online multiplayer; native app is local-only.

## Code Style & Conventions

### TypeScript & Imports

Strict mode enabled. Import groups in order:

1. React/external libraries
2. Internal types and utilities
3. Components

```typescript
import { useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { GameState, PlayerSymbol } from "@/app/types/types";
import { checkWinner } from "@/app/game/logic/checkWinner";
import { Button } from "@/components/ui/button";
```

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case.ts` or `PascalCase.tsx` | `check-winner.ts`, `GameBoard.tsx` |
| Components | `PascalCase` | `GameBoard`, `LoginForm` |
| Functions | `camelCase` | `makeMove`, `checkWinner` |
| Constants | `SCREAMING_SNAKE_CASE` | `TURN_DURATION_MS` |
| Enums | `PascalCase` | `PlayerSymbol`, `GameModes` |
| Types/Interfaces | `PascalCase` | `GameState`, `PlayerConfig` |
| Variables | `camelCase` | `gameBoard`, `currentPlayer` |
| Event handlers | `handleX` | `handleCellClick`, `handleLogin` |

### React Components

- Always functional components with hooks
- Add `"use client"` directive at top of client components
- Use typed props with interface:
  ```typescript
  interface GameBoardProps {
    gameState: GameState;
    onCellClick: (index: number) => void;
  }
  export default function GameBoard({ gameState, onCellClick }: GameBoardProps) { ... }
  ```
- Use `cn()` utility (from `@/lib/utils`) for className merging
- Update state immutably using functional setState

### Game Logic

- Keep logic functions **pure** (no side effects)
- Store all game logic in `app/game/logic/`
- Use constants from `app/game/constants/` for game rules
- Validate moves with `isValidMove()` before applying
- Track move history for piece removal logic (3-piece variant)

### AI Implementation

- All AI in `app/game/ai/`
- Route based on `AI_Difficulty` enum: EASY, NORMAL, HARD, INSANE
- Add realistic delays for AI moves (200-800ms for UX)
- Difficulty levels:
  - **Easy**: Simple heuristic/random
  - **Normal**: MCTS with 100 iterations
  - **Hard**: MCTS with 5,000 iterations
  - **Insane**: MCTS with 20,000 iterations

### Socket.IO (Online Multiplayer)

- **Server**: Custom Node.js server in `server.js` (not App Router route)
- **Client Hook**: Centralized in `app/hooks/socket.ts`
- **Connection**: `NEXT_PUBLIC_SOCKET_URL` env var (default: http://localhost:3009)
- **Production**: Use `pnpm start:prod` to run both Next.js and Socket.IO server
- Type events properly; clean up listeners in useEffect cleanup
- Handle connection/disconnection gracefully

### Styling

- Tailwind CSS utility classes (postcss 4 syntax)
- Dark mode pattern: `dark:variant-class`
- Use Radix UI primitives for accessibility
- shadcn/ui components in `components/ui/`
- Theme switching via `next-themes`

## Testing

- **Framework**: Vitest (unit), Jest (native)
- **Location**: `tests/` for web, `__tests__/` for native
- **Pattern**: `*.test.ts` or `*.test.tsx`
- For bug fixes: reproduce with test case first (empirical validation)
- Mock Socket.IO for multiplayer tests

## Environment Variables

```bash
NEXT_PUBLIC_SOCKET_URL    # Socket.IO server URL (default: http://localhost:3009)
NODE_ENV                  # development or production
SOCKET_PORT              # Socket server port (default: 3009)
```

Create `.env.local` in `/tic-tac-toe` with your overrides.

## Key Constants Reference

See `app/game/constants/` for:
- `TURN_DURATION_MS = 10000` - 10 second turn timer
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3` - 3-piece rule
- `BOARD_SIZE = 9` - 3x3 grid cells
- `PlayerSymbol` enum (X, O)
- `GameModes` enum (VS_COMPUTER, VS_FRIEND, ONLINE)
- `AI_Difficulty` enum (EASY, NORMAL, HARD, INSANE)
- Socket event constants

## Common Workflows

### Running the Full Stack

```bash
# In /tic-tac-toe:
pnpm dev              # Front-end + Next.js on 3000
# In separate terminal, if testing Socket.IO:
NODE_ENV=production node server.js  # Socket.IO on 3009
```

### Testing a Game Logic Change

```bash
# Reproduce bug with test:
pnpm test -- tests/unit/checkWinner.test.ts --watch

# Fix logic in app/game/logic/
# Test passes? Commit.
```

### Mobile App Setup (Advanced)

```bash
cd /TicTacToeMobile
npm install
npm start          # Start Metro bundler
npm ios            # Run iOS simulator
npm android        # Run Android emulator
npm test           # Jest tests
```

## Important Notes

1. **TypeScript Strict Mode**: Always define types. Use `@/app/types/types.ts` for shared types.
2. **Immutable State**: Never mutate state directly; use setState or spread operators.
3. **Performance**: Game logic and AI can be CPU-intensive; test responsiveness.
4. **Socket.IO Production**: `pnpm start` alone won't serve multiplayer. Use `pnpm start:prod` or run `server.js` separately.
5. **3-Piece Rule**: Understand move tracking; oldest move is removed when player reaches 4 pieces.
6. **Turn Timer**: 10 seconds enforced; random move triggers on timeout—test edge cases.
