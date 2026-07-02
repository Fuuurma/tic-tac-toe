# Convex Backend

This folder starts the durable profile/stats backend for the optional Google
OAuth migration. Guest play and Socket.IO online play remain the live gameplay
path for now.

## Current Scope

- `profiles`: guest/account profile records.
- `profileClaims`: future Better Auth account claim records.
- `playerStats`: durable win/loss/streak stats by guest or profile.
- `matches`: completed match result snapshots and profile/guest history reads.
- `rooms`, `roomPlayers`, `moves`, `roomInvites`: durable room, invite, player,
  and move primitives for the later Socket.IO-to-Convex bridge.

## Local Setup

1. Run `pnpm exec convex dev` and follow the Convex login/project prompts.
2. Commit regenerated files under `convex/_generated/` if they change.
3. Set `NEXT_PUBLIC_CONVEX_URL` only in environments that should sync guest
   profiles and completed online match results to Convex.
4. Set `CONVEX_URL` on the Socket.IO server when server-side room, player,
   leave, status, and move events should also be bridged to Convex. If
   `CONVEX_URL` is omitted, the server falls back to `NEXT_PUBLIC_CONVEX_URL`.

The checked-in `_generated` files are bootstrapping stubs so TypeScript can
compile before the first real Convex deployment is configured. `pnpm
convex:codegen` currently requires `CONVEX_DEPLOYMENT`; regenerate these files
with Convex CLI after setup.
