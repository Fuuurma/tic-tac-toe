# Tic Tac Toe

A strategic 3-piece Tic Tac Toe with AI and P2P multiplayer, built on the
standardized game stack.

## What is this

- **3-piece strategic variant**: max 3 pieces per player; oldest auto-removed
  on 4th (draw-free).
- **4 AI difficulties**: Easy (random), Normal (heuristic), Hard (minimax),
  Insane (MCTS).
- **P2P multiplayer**: host a room or join with a code, powered by PeerJS data
  channels and PeerJS Cloud signaling.
- **Guest play**: no sign-in required. Guest identity stored locally.

## Stack

| Layer    | Technology                  |
|----------|-----------------------------|
| Shell    | Vite 5 + React 19 + TS     |
| Styling  | Tailwind CSS v4             |
| Realtime | PeerJS (P2P)                |
| AI       | Minimax + MCTS              |
| Deploy   | Cloudflare Pages (static)   |

## Quick start

```bash
pnpm install
pnpm dev       # localhost:5173
pnpm build     # type-check + build to dist/
pnpm preview   # serve dist/ locally
```

## Tests

```bash
pnpm test          # Vitest unit tests
pnpm test:e2e      # Playwright smoke (local preview)
```

## Deploy to Cloudflare Pages

1. Push `feat/game-stack-vite-peerjs` (or `main` after Pass 2) to GitHub.
2. In the Cloudflare Dashboard → Pages → Create a project, connect the repo.
3. Build settings: **Framework preset = None**, build command `pnpm build`,
   output directory `dist`.
4. Deploy. Smoke the live URL:

```bash
E2E_BASE_URL=https://<your-pages-url> pnpm test:e2e
```

## Production caveat

The current build uses the shared PeerJS Cloud service for signaling and the
default STUN configuration. That is suitable for a demo, but not a complete
reliability plan: some NAT and corporate-network combinations require a TURN
relay, and higher-traffic apps should operate their own PeerServer. Treat a
managed TURN/signaling setup plus a public two-network smoke as a launch gate.

## Project structure

```
src/
  game/
    constants.ts    — enums, rules, colors
    logic.ts        — pure game state + move logic
    ai.ts           — AI engine (minimax + MCTS)
    *.test.ts       — unit tests
  hooks/
    usePeerRoom.ts  — P2P multiplayer hook
    useLocalGame.ts — local AI / 2-player hook
    useGameStats.ts — local stats (localStorage)
  components/
    auth/           — login form
    game/           — board, players panel, selectors
    ui/             — button, card
  lib/
    identity.ts     — guest identity (localStorage)
    peer.ts         — PeerJS message protocol
    utils.ts        — cn() helper
e2e/
  smoke.spec.ts     — Playwright smoke tests
```

## License

Private.
