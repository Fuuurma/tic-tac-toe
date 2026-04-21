# TicTacToe - Strategic 3-Piece Variant

A high-performance, multi-platform TicTacToe game featuring a unique strategic twist: players are limited to 3 pieces on the board at any time. When a player places their 4th piece, their oldest one is automatically removed, creating a dynamic, draw-free experience.

## Features

- **3-Piece Rule**: Maximum 3 pieces per player; oldest piece is auto-removed on the 4th move.
- **Multi-Platform**: Seamlessly deployed as a Web App (Next.js) and Native Mobile App (iOS/Android via Capacitor).
- **Minimal Anonymous Auth**: Play instantly as a guest or with a simple username; no registration required.
- **AI Opponent**: Multiple difficulty levels (Easy, Normal, Hard, Insane) powered by MCTS and Minimax.
- **Real-time Statistics**: Detailed tracking of wins, losses, draws, and win streaks (current and best).
- **Online Multiplayer**: Real-time play via Socket.IO with rematch and room management.
- **Turn Timer**: 10-second turns with automatic random moves on timeout.
- **Modern UI**: Built with Tailwind CSS 4, Radix UI, and shadcn/ui with full dark mode support.

## Tech Stack

- **Framework**: Next.js 15+, React 19, TypeScript
- **Mobile**: Capacitor 8+
- **Styling**: Tailwind CSS 4+
- **Real-time**: Socket.IO 4+
- **Testing**: Vitest
- **AI**: Monte Carlo Tree Search (MCTS) & Minimax

## Installation

### Prerequisites
- Node.js 18+
- pnpm

### Setup
1. `pnpm install`
2. `pnpm dev`
3. Open [http://localhost:3000](http://localhost:3000)

## Development Commands

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start:prod       # Start production server with Socket.IO
pnpm lint             # Run linting
pnpm test:unit        # Run unit tests
pnpm cap:sync         # Sync to mobile platforms
```

## Project Structure

- `app/`: Next.js App Router and core logic.
- `app/hooks/game/`: Specialized hooks for stats, timer, local, and socket logic.
- `app/game/logic/`: Pure game rule implementations.
- `app/game/ai/`: AI algorithms (MCTS, Minimax).
- `components/`: Modular React components.
- `server.js`: Custom Node.js server for Next.js + Socket.IO.

## Deployment

### Web & Backend (Railway)
Deploy `server.js` to Railway or similar providers. Ensure `NEXT_PUBLIC_SOCKET_URL` is set to your deployment URL.

### Mobile (Capacitor)
1. `pnpm build`
2. `pnpm cap:sync`
3. `pnpm cap:ios` or `pnpm cap:android`

## License
MIT
