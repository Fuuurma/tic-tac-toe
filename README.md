# Tic Tac Toe

A strategic three-piece Tic Tac Toe with AI, local two-player, host-first
online rooms, and quick-match pairing.

## Current slice

The public URL is a preview, not a production launch:
https://tic-tac-toe-1ou.pages.dev

The web client uses the shared `fuurma-matchmaking` Cloudflare Worker for quick
matchmaking and a per-room Durable Object WebSocket relay. No account is required.

## Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS v4
- Shared Cloudflare Worker + Durable Object WebSocket relay
- Client-side AI with three levels: Easy (random with center/corner preference), Normal (depth-4 alpha-beta minimax), and Hard (depth-8 alpha-beta minimax)
- Vitest + Playwright
- Cloudflare Pages for the static build

## Commands

```bash
pnpm install
pnpm dev          # dev server at 127.0.0.1:3110
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm check        # lint + test + e2e
```

`pnpm test:e2e` runs against a local preview. Online flows need the sibling
Worker at `~/Projects/fuurma-matchmaking` on `127.0.0.1:8787`.

## Online model

- The room creator is the host and owns the authoritative game state and timer.
- The host's symbol (X or O) is randomized at room creation and again on each
  rematch — use `hostSymbolRef` / `guestSymbolRef` to look up the actual symbol.
- X always moves first regardless of who is X.
- The guest sends move intents; the host validates and broadcasts state.
- Private rooms can use a generated code or a custom 4–64 character code, with
  copyable room codes and invite links.
- Before a connection is ready, the UI stays in a focused waiting/connecting
  state instead of showing a disabled board; connection errors offer a retry or
  a return to setup.
- A transient `peer-left` with reason `disconnect` enters reconnecting state;
  the room keeps the slot for 30 seconds.
- `peer-reconnected` restores the connection. `closed` and `expired` are final.
- Quick match uses `/api/matchmaking/tictactoe` on the shared Worker.

## Game rules and controls

- Each player can place three marks. On a fourth move, that player's oldest
  mark is removed automatically.
- Use number keys `1`–`9` to play the matching board cell (1 = top-left,
  9 = bottom-right); shortcuts stay out of text inputs and dialogs.
- Display names persist after starting a game, and invalid room codes explain
  the required format inline.

## Project layout

```text
src/game/               pure rules, state, and AI
src/hooks/              useLocalGame, usePeerRoom, useGameStats
src/lib/                peer protocol, RoomClient, identity, matchmaking, utils
src/components/         board, lobby, panels, selectors, online surface
e2e/                    Playwright smoke tests
public/                 static assets and Cloudflare Pages config
```

## Before launch

Deploy the current Worker and Pages build, then verify private-room and
quick-match play across two networks, reconnect within 30 seconds, and final
expiry after the grace period. Keep guest play working when optional OAuth is
not configured.

Private.
