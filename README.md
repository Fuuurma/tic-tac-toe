# TicTacToe - Strategic 3-Piece Variant

A high-performance, multi-platform TicTacToe game featuring a unique strategic twist: players are limited to 3 pieces on the board at any time. When a player places their 4th piece, their oldest one is automatically removed, creating a dynamic match that keeps moving until someone wins.

## Features

- **3-Piece Rule**: Maximum 3 pieces per player; oldest piece is auto-removed on the 4th move.
- **Multi-Platform**: Seamlessly deployed as a Web App (Next.js) and Native Mobile App (iOS/Android via Capacitor).
- **Minimal Anonymous Auth**: Play instantly as a guest or with a simple username; no registration required.
- **AI Opponent**: Multiple difficulty levels (Easy, Normal, Hard, Insane) powered by MCTS and Minimax.
- **Real-time Statistics**: Detailed tracking of wins, losses, and win streaks (current and best).
- **Online Multiplayer**: Real-time play via Socket.IO with rematch and room management.
- **Turn Timer**: 10-second turns with automatic random moves on timeout.
- **Modern UI**: Built with Tailwind CSS 4, Radix UI, and shadcn/ui with full dark mode support.

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
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

## Environment Variables

- `NEXT_PUBLIC_SOCKET_URL`: optional Socket.IO server URL when the realtime server is hosted separately from the web app.
- `SOCKET_CORS_ORIGIN`: optional comma-separated list of allowed Socket.IO origins, for example `https://example.com,https://www.example.com`. Defaults to `*`.
- `LOG_LEVEL`: optional server log level: `silent`, `error`, `warn`, `info`, or `debug`.

## Project Structure

- `app/`: Next.js App Router and core logic.
- `app/hooks/game/`: Specialized hooks for stats, timer, local, and socket logic.
- `app/game/logic/`: Pure game rule implementations.
- `app/game/ai/`: AI algorithms (MCTS, Minimax).
- `components/`: Modular React components.
- `server.js`: Custom Node.js server for Next.js + Socket.IO.

## Deployment

### Web & Backend (Railway)
Deploy `server.js` to Railway or similar providers. The Next.js app and Socket.IO server run on the same origin by default, so `NEXT_PUBLIC_SOCKET_URL` is only needed when the Socket.IO server is hosted separately.

### Mobile (Capacitor)
1. `pnpm build`
2. `pnpm cap:sync`
3. `pnpm cap:ios` or `pnpm cap:android`

## License
MIT
