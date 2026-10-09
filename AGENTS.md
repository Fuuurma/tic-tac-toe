<!-- fuurma-hub-start -->
## Fuurma Hub Context

This repo is one project inside the Fuurma portfolio workspace. The planner hub
is the source of truth for cross-project priorities, reusable stack decisions,
ports, deploy/auth notes, and agent handoffs.

Before meaningful work, read:
1. Current sprint / next work: `~/Projects/hub/WORK.md`
2. This project's state page: `~/Projects/hub/projects/tic-tac-toe/STATE.md`
3. Standard stack playbook: `~/Projects/hub/tech-stack/CONVENTIONS.md`
4. Agent skills/context: `~/Projects/hub/tech-stack/AGENT-CONTEXT.md`
5. Official docs index: `~/Projects/hub/tech-stack/OFFICIAL-DOCS.md`

Use the deeper hub docs when relevant:
- Auth/OAuth: `~/Projects/hub/tech-stack/AUTH-OAUTH.md`
- Forms: `~/Projects/hub/tech-stack/TANSTACK-FORM.md`
- Deploy/launch: `~/Projects/hub/tech-stack/SHIP-KIT.md`
- Ports: `~/Projects/hub/tech-stack/PORTS.md`
- Secrets/accounts: `~/Projects/hub/tech-stack/ACCOUNTS-SECRETS.md`

Operational rules:
- Run `git status --short --branch` before editing and protect dirty user/agent work.
- Product repo code/tests are the immediate truth; when they disagree with the hub, update the hub after verifying.
- After reading the hub pointers, keep reading this file's repo-local instructions; they are the authority for this codebase.
- Use `pnpm@10.30.2` unless this repo explicitly documents a different toolchain.
- When you learn a reusable pattern, fix, or project-state change, update `~/Projects/hub` so the next agent starts stronger.

### Agent skills and generated guidance

When one of these global skills matches your work, **invoke it immediately** at the start of the session:
- `design-arsenal` — UI/UX, visual polish, landing pages, design direction. Front door: `~/Projects/hub/design/README.md`.
- `design-taste-frontend` / `hallmark` / `impeccable` — anti-slop design quality on every UI pass.
- `shadcn` — adding, fixing, or reviewing shadcn/ui components and Tailwind v4 styling.
- `convex` — routing Convex work to the right helper skill (quickstart, auth, components, migrations, performance audit).
- `stripe-best-practices` — checkout, billing, subscriptions, webhooks, Connect, key handling.
- `workers-best-practices` / `durable-objects` / `cloudflare` — Cloudflare Workers, Wrangler, bindings, Durable Objects, Agents SDK.
- `cloudflare-email-service` / `turnstile-spin` — when adding those services.
- `convex-setup-auth`, `convex-create-component`, `convex-migration-helper`, `convex-performance-audit` — repo-local Convex skills when present.

For Convex repos, run `npx convex ai-files install` first if `convex/_generated/ai/guidelines.md` is missing or stale.

For UI/UX, landing, visual polish, or any screen users see: invoke `design-arsenal` first, then `design-taste-frontend`, `hallmark`, and `impeccable`. Read `~/Projects/hub/design/README.md`. Pull `tools.md` or `inspiration.md` only as needed. A repo `DESIGN.md` wins when it exists.

For UI implementation, use `pnpm dlx shadcn@latest` and follow the `shadcn` skill rules (no `space-x/y`, use `gap-*`, `size-*`, `cn()`, semantic tokens, lucide icons, `FieldGroup`/`Field`, etc.).

For TanStack Start/Router/Form, there is no global skill; follow `CONVENTIONS.md`, `CONVENTIONS.md`, and `TANSTACK-FORM.md`. Use TanStack Form for every new form and every touched legacy form.

For Better Auth, follow `AUTH-OAUTH.md` exactly.
<!-- fuurma-hub-end -->


# AGENTS.md

Guidelines for agentic coding tools working on this TicTacToe project.

## Development Commands

```bash
# Install dependencies
pnpm install

# Dev server
pnpm dev

# Build (type-check + Vite)
pnpm build

# Preview production build locally
pnpm preview

# Lint
pnpm lint

# Unit tests
pnpm test

# Playwright smoke (local: runs against pnpm preview)
pnpm test:e2e

# Playwright smoke (deployed: against the real URL)
E2E_BASE_URL=https://<your-url> pnpm test:e2e

# Full local production gate
pnpm check
```

## Project Structure

- `src/` — Vite + React application
  - `src/game/` — pure game domain (rules, AI, constants)
  - `src/hooks/` — React hooks (usePeerRoom, useLocalGame, useGameStats)
  - `src/components/` — UI (board, lobby, panels, selectors, confirm dialog)
  - `src/lib/` — utilities (identity helper, WebSocket protocol, cn())
- `e2e/` — Playwright smoke tests
- `public/` — static assets and `_headers` (CF Pages)
- `wrangler.jsonc` — Cloudflare Pages config

## Stack

- **Shell**: Vite 8 + React 19 + TypeScript + Tailwind v4
- **Realtime**: Cloudflare Durable Object WebSocket relay inside the shared `fuurma-matchmaking` Worker
- **Backend**: Shared `fuurma-matchmaking` Cloudflare Worker for quick match pairing and `GameRoomDO` WebSocket relay
- **Auth**: None (guest-only)
- **Deploy**: Cloudflare Pages (static, `dist/`)
- **Testing**: Vitest (unit) + Playwright (smoke)
- **AI**: Easy weighted random play, Normal depth-4 alpha-beta Minimax, Hard depth-8 cycle-safe alpha-beta Minimax (client-side)

## Code Style

- Functional components with hooks, `"use client"` not needed (Vite SPA)
- Use `cn()` from `@/lib/utils` for className merging
- Use `useCallback`/`useMemo` for event handlers and expensive computations
- Pure game logic in `src/game/` must not import React
- Game message types are a discriminated union in `src/lib/peer.ts` (the filename is historical; transport is WebSocket-only)

## Game Rules

- 3-piece strategic variant: max 3 pieces per player, oldest auto-removed on 4th
- 10s turn timer; on timeout, random legal move
- Win detection: 3 in a row/column/diagonal

## WebSocket Relay Model

- Default transport is the shared `fuurma-matchmaking` Cloudflare Durable Object WebSocket relay
- The historical `VITE_USE_WS_ROOM=true` flag is removed from `.env.production`; the code always uses WebSockets and there is no non-WebSocket fallback
- Room creator = host, owns game state and timer. The host's symbol (X or O) is randomized at room creation and again on each rematch — use `hostSymbolRef` / `guestSymbolRef` to look up the actual symbol, never hardcode X or O
- Guest sends move intents to host; host validates, applies, and broadcasts state to guest
- Inbound wire frames are validated by `isPeerMessage`/`isGameState` in `src/lib/peer.ts` (colors, display names, move indices, winning lines, timer bounds, game-mode/AI-difficulty/player-type enums)
- Host resets `turnTimeRemaining` to `TURN_DURATION_MS` after `peer-reconnected` so a same-identity reconnect cannot trigger an immediate random move
- Either side may request a rematch: both send `rematchRequested` with their own symbol and arm the same 30s expiry. The host still owns the reset, so it answers a guest request locally (`acceptIncomingRematch`) instead of sending an accept and waiting for its own echo
- The host gates `rematchAccept` on a pending request of its own and on the previous game being terminal; a stray guest accept is ignored. It gates an incoming guest request the same way, and on `guestJoinedRef` so a peer that never joined cannot pop a prompt over live play
- Requesting while a prompt is already up is a no-op on both sides: answering one request and asking another would leave both players waiting
- Forfeit winner is determined by the actual host/guest symbol refs, not hardcoded X/O
- `peer-left: disconnect` is transient during the 30-second reconnect grace; `peer-reconnected` restores the peer; `closed` and `expired` are final

## Local Move Commit

- Every local move commits through `commitLocalMove` (`src/hooks/localTurnTimer.ts`) with a `cur === prev` identity guard, so a decision computed off the post-render `gameStateRef` snapshot can never clobber a newer commit
- An identity mismatch does **not** mean a rival move landed: the turn clock rewrites `turnTimeRemaining` onto a fresh object every second. The AI's move is scheduled 700-1300ms after the turn starts against a 1000ms clock, so roughly half of all AI moves land in the same batch as a tick. `commitLocalMove` therefore takes an optional pure `rebase(cur)` that re-derives the move from whatever actually committed and drops only when a real move took the turn. Dropping there used to strand the AI until the turn expired

## Text Color

- `color` is published once on `html/body/#root` in `src/index.css` and every themed color flips with `prefers-color-scheme`. Nothing else sets a document-level color, because that omission is invisible in review and brutal in dark mode: any element without its own `text-*` utility inherits the UA default black and disappears into the dark gradient. That is what made the Confirm titles, the help and settings headings, and the HUD player names invisible before. Add an explicit color when you add text, but never assume inheritance is neutral
- `color-scheme: light dark` on `:root` keeps UA-drawn surfaces (the app-shell scrollbar, input chrome) on the same palette the `dark:` variants key off, so the two cannot disagree

## Mobile Layout

- The app shell stretches its child below `sm` and centers at `sm:`. Auto cross-axis margins suppress the stretch, so the lobby wrapper leaves `my-auto` off (its card stretches to fill a phone) while the game wrapper keeps it (the board stays vertically centred instead of hanging off the top of a tall phone with 300px of dead space below)
- The lobby form is `my-auto max-h-full` against that stretched shell: short content centres at its natural size, tall content (Online adds a match-type row and a room-code field) fills the phone and scrolls its middle while the footer keeps Start pinned. Never let the card grow past `max-h-full` — that is what pushed the primary action below the fold
- Sheet drag-to-dismiss (`src/hooks/useDragToDismiss.ts`) is bound to the sheet's grabber/header, never the panel. Winning the gesture needs `touch-action: none`, and putting that on the panel would make its own pickers unscrollable; the handle carries `DRAG_HANDLE_TOUCH_ACTION` instead
- `useDismissOnOutsidePress` dismisses on `click`, not `pointerdown`. These panels expand inside a sheet, so collapsing one on pointerdown reflows the sheet and slides its close button ~35px before the pointer comes back up, swallowing the tap. Same reason the active check on `OnlineOption` is positioned out of flow: an inline check ate the label's width and truncated "Join" to "J…" at 320px

## Rendering Budget

- `BackgroundPattern` keeps the resting symbol grid on an offscreen base layer and repaints only the lit spotlight region per frame. `clearRect` the region before `drawImage`-ing the base back: a transparent source pixel composites as a no-op, so the copy alone leaves the previous frame baked in
- Canvas resolves gradient coordinates in the user space of the fill, not of `createRadialGradient`. The cached spotlight gradient is built at the origin and painted under `ctx.translate(pointer.x, pointer.y)`
- Pointer handlers record the position and start the rAF loop; they never draw. A synchronous draw per event repaints the grid twice per frame
- The reveal follows the pointer's path, not just its position. Samples are laid down by distance travelled (`TRAIL_SAMPLE_STEP`) and aged out by time (`TRAIL_FADE_MS`), so a fast flick leaves a streak, a slow drag keeps a halo, and a resting cursor collapses to the single-point halo. Pointer speed decides the look for free — no explicit velocity maths
- `TRAIL_MAX_SPAN` is a performance dial first: the repaint box grows with the trail, and each extra pixel is another base-layer blit. Measured on a 4x throttled mid-range viewport during a continuous sweep, the trail costs ~1ms median frame and takes dropped frames from ~1.7% to ~3.1%. Idle and a parked cursor cost nothing — the rAF loop stops entirely
- Measure main-thread cost with `requestAnimationFrame` frame gaps. Headless Chromium's `longtask` `PerformanceObserver` reports nothing, even for a deliberate 120ms block, so a clean long-task reading is an unproven instrument

## Record Storage

- `useGameStats` stores one record per guest under `tic-tac-toe:stats:<guestId>`, the same identity key as the display name
- `GameStats.breakdown` keys results by `mode` (or `mode:difficulty` for vs Computer) so the record can be split per mode and AI difficulty. Records written before the field existed load with `breakdown: {}`
- `recordWin`/`recordLoss` require a `StatsContext`; passing the wrong mode or difficulty would misfile the result, so every caller passes the mode it actually played

## Key Constants

- `TURN_DURATION_MS = 10_000` (10s per turn)
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3`
- `BOARD_SIZE = 9`
- AI difficulties: EASY (weighted random with center/corner preference), NORMAL (depth-4 eviction-aware alpha-beta Minimax with randomized equal-score choices), HARD (depth-8 cycle-safe alpha-beta Minimax with stable best play)
- Helpers in `constants.ts`: `oppositeSymbol(symbol)`, `randomPlayerSymbol()`, `oppositeColor(color)` — use these instead of inline ternaries

### Engineering foundation

Before implementation, debugging, architecture work, agent-instruction edits,
or knowledge curation, invoke `hub-foundation` from `.devin/skills/`.
If the harness cannot invoke it, read `.devin/skills/hub-foundation/SKILL.md`
explicitly and follow only the references relevant to the approved task.
The foundation supplements this repository's rules; it grants no additional
permissions. `retro` is owner-invoked, and raw session history stays local.
Provenance: `.devin/skills/mattpocock-source.json`.
