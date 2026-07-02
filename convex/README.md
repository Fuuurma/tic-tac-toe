# Convex Backend

This folder starts the durable profile/stats backend for the optional Google
OAuth migration. Guest play and Socket.IO online play remain the live gameplay
path for now.

## Current Scope

- `profiles`: guest/account profile records.
- `profileClaims`: future Better Auth account claim records.
- `playerStats`: durable win/loss/streak stats by guest or profile.
- `matches`: completed match result snapshots.
- `rooms`, `roomPlayers`, `moves`, `roomInvites`: durable room, invite, player,
  and move primitives for the later Socket.IO-to-Convex bridge.

## Local Setup

1. Run `pnpm exec convex dev` and follow the Convex login/project prompts.
2. Commit regenerated files under `convex/_generated/` if they change.
3. Set `NEXT_PUBLIC_CONVEX_URL` only in environments that should sync guest
   profiles and completed online match results to Convex.

The checked-in `_generated` files are bootstrapping stubs so TypeScript can
compile before the first real Convex deployment is configured. Regenerate them
with Convex CLI after setup.
