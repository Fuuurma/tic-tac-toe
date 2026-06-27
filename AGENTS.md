# AGENTS.md

This document provides guidelines for agentic coding tools working on this TicTacToe project.

## Development Commands

```bash
# Install dependencies with pnpm
pnpm install

# Development server with Turbopack (faster builds)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Run all tests
pnpm test

# Run a single test file
pnpm test -- tests/unit/checkWinner.test.ts

# Run tests in watch mode
pnpm test:watch

# Run unit tests only
pnpm test:unit

# Run integration tests
pnpm test:integration

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Project Structure

- `app/` - Next.js App Router pages and server logic
  - `game/logic/` - Core game state management functions
  - `game/ai/` - AI implementation (MCTS, Minimax, Simple AI)
  - `game/constants/` - Game constants, enums, and configurations
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
  - `hooks/` - Custom React hooks (`game/`, useSound.ts, useAnalytics.ts, useServiceWorker.ts)
- `components/` - React components organized by feature
  - `ui/` - shadcn/ui reusable components
  - `game/` - Game-specific components (board, buttons, panels)
  - `auth/` - Login and authentication forms
  - `menu/` - User menu and theme toggler
  - `navbar/` - Sidebar and header components
  - `common/` - Shared components (footer, error messages)
- `lib/` - Utility functions (cn() for className merging)
- `server.js` - Custom Socket.IO server (production multiplayer)
- `tests/` - Test files (unit, integration, load)

## Code Style Guidelines

### Imports

```typescript
// React and libraries first
import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// Internal imports
import { GameState, PlayerSymbol } from "@/app/types/types";
import { checkWinner } from "@/app/game/logic/checkWinner";

// Component imports
import { Button } from "@/components/ui/button";
import GameBoard from "@/components/game/board";
```

### Naming Conventions

- **Files**: `kebab-case.ts` or `PascalCase.tsx` for components
- **Components**: `PascalCase` (e.g., `GameBoard`, `LoginForm`)
- **Functions**: `camelCase` (e.g., `makeMove`, `checkWinner`)
- **Constants**: `SCREAMING_SNAKE_CASE` for constants, `PascalCase` for enums
- **Types/Interfaces**: `PascalCase` (e.g., `GameState`, `PlayerConfig`)
- **Variables**: `camelCase`
- **Event handlers**: `handleX` (e.g., `handleLogin`, `handleCellClick`)

### TypeScript Best Practices

- Use strict mode (enabled in tsconfig.json)
- Define types in `app/types/types.ts`
- Use enums for constants with limited values:
  ```typescript
  export enum PlayerSymbol {
    X = "X",
    O = "O",
  }
  ```
- Use `as const` for constant objects to prevent mutations:
  ```typescript
  export const WINNING_COMBINATIONS: WinningLine[] = [
    [0, 1, 2],
    // ...
  ] as const;
  ```
- Always type component props:
  ```typescript
  interface GameBoardProps {
    gameState: GameState;
    handleCellClick: (index: number) => void;
  }
  export const GameBoard = ({ ... }: GameBoardProps) => { ... }
  ```

### Components

- Use functional components with hooks
- Add `"use client"` directive at top of client components
- Destructure props for clarity
- Use typed props interface with function component syntax
- Use `cn()` utility for conditional className merging:
  ```typescript
  import { cn } from "@/lib/utils";
  <div className={cn("base-class", isActive && "active-class")} />
  ```

### State Management

- Use `useState` for local component state
- Use `useCallback` for event handlers passed to children
- Use `useMemo` for expensive computations
- Update state immutably:
  ```typescript
  setGameState((prev) => ({
    ...prev,
    board: newBoard,
    currentPlayer: nextPlayer,
  }));
  ```

### Error Handling

- Use error messages from `ERROR_MESSAGES` constant in constants.ts
- Display errors to users via `ErrorMessage` component
- Log errors with `console.error()` for debugging
- Validate user input before processing
- Handle Socket.IO errors with error event listeners

### Testing

- Use Vitest for unit, integration, and load testing
- Test files: `*.test.ts` in `tests/` directory
- Run specific test: `pnpm test -- tests/unit/checkWinner.test.ts`
- Mock Socket.IO for multiplayer tests

### Game Logic

- Keep logic functions pure where possible (input → output)
- Store all game logic in `app/game/logic/`
- Use constants for game rules and configurations
- Validate moves with `isValidMove()` before applying
- Track moves for piece removal logic (3-piece rule)
- Implement timeouts: 10 seconds per turn with automatic random move

### AI Implementation

- AI logic in `app/game/ai/`
- Route to appropriate algorithm based on `AI_Difficulty` enum
- Add delays for UX when AI makes moves
- Handle AI turn check with `isAITurn()` helper
- Support difficulty levels: EASY, NORMAL, HARD, INSANE

### Socket.IO (Online Multiplayer)

- Socket server is in root `server.js` (custom Next.js server, not App Router API route)
- Client socket hook in `app/hooks/game/useSocketGame.ts`
- Use typed events: `ServerToClientEvents`, `ClientToServerEvents`
- Clean up listeners in useEffect cleanup function
- Handle connection/disconnection gracefully
- Default server URL: current browser origin (configurable via NEXT_PUBLIC_SOCKET_URL when Socket.IO is hosted separately)
- Production: use `pnpm start:prod` to run the custom server

### Styling

- Use Tailwind CSS utility classes
- Follow dark mode pattern: `dark:variant-class`
- Use Radix UI primitives for accessible components
- shadcn/ui components in `components/ui/`
- Color variants defined in `constants.ts` with Tailwind mappings
- Theme switching via `next-themes` and `ThemeProvider`

### ESLint

- Run `pnpm lint` before committing
- Uses Next.js recommended config: `next/core-web-vitals`, `next/typescript`
- Configured via `eslint.config.mjs`

### File Organization

- Group related files in feature folders
- Keep components close to where they're used
- Export named functions (not default) for utilities
- Use default export for main components and pages
- Index files (`index.ts`) for barrel exports when needed

### Code Comments

- Add comments only when logic is complex or non-obvious
- Avoid redundant comments for self-explanatory code
- Use TODO comments for temporary/future work

## Environment Variables

- `NEXT_PUBLIC_SOCKET_URL` - Optional Socket.IO server URL when it is hosted separately from the Next.js app
- `NODE_ENV` - Environment (development/production)

## Key Constants Reference

- `TURN_DURATION_MS = 10000` - 10 seconds per turn
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3` - 3-piece rule
- `BOARD_SIZE = 9` - 3x3 grid
- Socket events defined in `Events` constant object
- All game modes in `GameModes` enum
- All colors in `Color` enum with `COLOR_VARIANTS` mappings
