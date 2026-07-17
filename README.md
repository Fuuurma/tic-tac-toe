# Tic Tac Toe

A strategic three-piece Tic Tac Toe with AI, local two-player, guest-first
online rooms, and quick-match pairing.

## Current slice

The public URL is a preview, not a production launch:
https://tic-tac-toe-1ou.pages.dev

The web client uses the shared `fuurma-matchmaking` Cloudflare Worker for quick
matchmaking and a per-room Durable Object WebSocket relay. PeerJS, STUN, and
TURN are not part of the current architecture. No account is required.

## Stack

- Vite 8 + React 19.2 + TypeScript
- Tailwind CSS v4 + shadcn/ui/Radix primitives
- Shared Cloudflare Worker + Durable Object WebSocket relay
- Client-side Minimax and MCTS AI
- Motion + `tw-animate-css`
- Vitest + Playwright
- Cloudflare Pages for the static build

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm check
```

`pnpm test:e2e` runs against a local preview. Online flows need the sibling
Worker at `~/Projects/fuurma-matchmaking` on `127.0.0.1:8787`.

## Online model

- The room creator is the host and owns the authoritative game state and timer.
- The guest sends move intents; the host validates and broadcasts state.
- A transient `peer-left` with reason `disconnect` enters reconnecting state;
  the room keeps the slot for 30 seconds.
- `peer-reconnected` restores the connection. `closed` and `expired` are final.
- Quick match uses `/api/matchmaking/tictactoe` on the shared Worker.

## Project layout

```text
src/game/               pure rules, state, and AI
src/hooks/usePeerRoom   WebSocket room lifecycle and reconnect behavior
src/hooks/               local game and stats hooks
src/lib/room.ts          room protocol types/client
src/lib/matchmaking.ts   quick-match API client
src/components/          board, lobby, and guest identity UI
e2e/                     Playwright smoke tests
```

## Before launch

Deploy the current Worker and Pages build, then verify private-room and
quick-match play across two networks, reconnect within 30 seconds, and final
expiry after the grace period. Keep guest play working when optional OAuth is
not configured.

Private.
