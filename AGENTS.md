<!-- fuurma-hub-start -->

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

## Definition of done

A change is finished when all four are true, not when the code looks right:

```bash
pnpm lint          # eslint src e2e vite.config.ts vitest.config.ts playwright.config.ts
pnpm test          # vitest run — 807 tests / 72 files
pnpm build         # tsc -b && vite build
```

`pnpm test:e2e` needs the matchmaking Worker on `127.0.0.1:8787`; run it when the
change touches online play, and say so when you could not. A red suite is
never acceptable to land: if it was red before you started, fix that or report
it, do not inherit it.

Behaviour changes need a red-first case — write the assertion, watch it fail on
the old code, then fix. The commit body records the failing output; that is how
`F785`, `F805` and every drift fix in this repo is legible a month later.

## Principles

Four rules that every refactor here has followed, and that resolve most "where
should this live?" questions:

1. **One source of truth per fact, in the module that owns the concept.** Not a
   shared `utils.ts`. A fact that two surfaces must agree on cannot live in
   two places — a busy rule, a bucket table and a class recipe in this repo each
   drifted the moment they were copied. If it must be copied (the palette is
   mirrored into `index.css`), a test pins the copies together.
2. **Let the compiler carry the invariant where it can.** i18n parity is
   `Record<StringKey, string>`; the colour maps are exhaustive `Record<Color, …>`;
   `GameSetup` replaced an eleven-field hand copy. Prefer a type that fails the
   build over a convention that fails in review.
3. **Test the seam, not the wiring.** The protocol modules take their refs as
   plain objects (`src/lib/room-protocol/`), so the state machine is testable
   without React; `src/game/` is React-free by test. If a behaviour is only
   reachable through a rendered component, ask whether it belongs lower.
4. **A module used by one component stays beside it.** Depth comes from putting
   behaviour behind a small interface, not from flattening the tree. See the
   `backgroundField.ts` exception in Project Structure.

## Where the detail lives

- **How the system works** — protocol, engine, storage, performance measurements:
  [ARCHITECTURE.md](ARCHITECTURE.md)
- **How it should look and move** — the visual contract, references and the
  NEVER/MUST list: [DESIGN.md](DESIGN.md) (it outranks this file on visuals)
- **How to release** — Pages, the Worker, and the `plain_text` trap:
  [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **What work exists and what shipped** — the hub queue and this project's
  ledger, not this file.

This file is the operating contract: commands, layout, tests, style, gates. It
deliberately does not restate system behaviour or design intent — a fact written
here as well is a fact that will drift.

## Project Structure

- `src/` — Vite + React application
  - `src/game/` — pure game domain (rules, AI, turn clock, constants); must not import React
  - `src/hooks/` — React hooks only (usePeerRoom, useLocalGame, useGameStats)
  - `src/lib/` — non-React logic: identity, preferences, onboarding gate, matchmaking client, `src/lib/peer.wire.ts` (the wire union, bounds and validators), `src/lib/peer.apply.ts` (the state transitions), `src/lib/room-protocol/`, `src/lib/ctaStyle.ts`, `src/lib/storage.ts`
  - `src/lib/room-protocol/` — the host/guest protocol state machine: message handling, room lifecycle, relay events, the turn timer, and the `src/lib/room-protocol/state.ts` vocabulary. No hooks live here
  - `src/components/` — UI (board, lobby, panels, selectors, confirm dialog)
  - `src/components/onboarding/` — first-run flow: welcome, profile, practice round, ready
  - `src/__tests__/` — repo-level pins: the AGENTS.md structure guard, package/CI metadata pins, the Vite chunk map
- `e2e/` — Playwright smoke tests
- `public/` — static assets and `_headers` (CF Pages)
- `wrangler.jsonc` — Cloudflare Pages config

**The placement rule, so this does not drift again.** A directory is named for what it holds:

- No hooks in `src/hooks/`? Then it is not a hook — it belongs in `src/lib/`. The old hooks/peer-room directory held 1,884 lines of protocol state machine with zero `useState`/`useEffect`/`useRef` calls, and the type graph said the protocol depended on a React hook. That directory is `src/lib/room-protocol/` now, and the state types it needs live in `src/lib/room-protocol/state.ts` so the dependency points the right way.
- A pure module used by more than one feature is library code, not UI: `src/lib/room-protocol/waitPhase.ts` and `src/lib/ctaStyle.ts` moved there for that reason.
- **A pure model used by exactly one component stays beside it.** `src/components/backgroundField.ts` is the heat-field model for `BackgroundPattern` and nothing else imports it; separating them would cost locality for nothing. This is the one deliberate exception to "components/ is UI only".
- `src/components/onboarding/` is a feature folder, not a dumping ground for shared helpers — anything the lobby or the game also needs goes to `src/lib/`.

## Tests

One convention, so a reader can find the test for a module without guessing:

- **Colocated.** A test sits beside the module it tests, named `<module>.test.ts` (or `.tsx` when it renders). `src/game/ai.behavior.test.ts` tests `src/game/ai.ts`.
- **Suffixed variants are the norm, not an exception.** A module with more than one suite keeps them apart by suffix rather than by directory: `peer.wire.hostile.test.ts`, `peer.integration.test.ts`, `ai.selfplay.test.ts`, `ai.bench.test.ts`, `usePeerRoom.rematchTimeout.test.tsx`, `board.render.test.tsx`. The suffix names the *angle* (hostile input, cross-module integration, self-play, benchmark), so the suite that guards a risk is findable by the risk.
- **A test named after another module is a bug in the test.** `peerProtocol.test.ts` lived under `src/__tests__/` and tested `hooks/peer-room/*`; it is now `lib/room-protocol/protocol.test.ts`. If the file you are editing has no same-named test, check for a suffixed variant before concluding it is untested.
- **`src/__tests__/` is only for repo-level pins** — tests whose subject is the repository rather than a module: the AGENTS.md path inventory guard, package/CI metadata pins, the Vite chunk map. Nothing that tests `src/` code belongs there; that is what colocation is for.
- A module covered only through a sibling's suite is acceptable but say so: `usePeerRoom.ts` is exercised by nine `room-protocol` suites rather than a colocated one, because its behaviour is the protocol's.

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
- Selectable tiles (radio/option chips) take their selected/unselected styling from `pickerTileClass(selected, weight?)` in `src/lib/pickerClasses.ts`, never by hand: the recipe had been written out at nine sites and drifted into four selected variants. Compose site-specific extras on top with `cn()`, and see that module's doc for the two surfaces that are deliberately not tiles (`pickerDisclosure` is a trigger; the game-mode tiles are a card surface).
- Use `useCallback`/`useMemo` for event handlers and expensive computations
- Pure game logic in `src/game/` must not import React
- Game message types are a discriminated union in `src/lib/peer.ts` (the filename is historical; transport is WebSocket-only)

### Engineering foundation

Before implementation, debugging, architecture work, agent-instruction edits,
or knowledge curation, invoke `hub-foundation` from `.devin/skills/`.
If the harness cannot invoke it, read `.devin/skills/hub-foundation/SKILL.md`
explicitly and follow only the references relevant to the approved task.
The foundation supplements this repository's rules; it grants no additional
permissions. `retro` is owner-invoked, and raw session history stays local.
Provenance: `.devin/skills/mattpocock-source.json`.
