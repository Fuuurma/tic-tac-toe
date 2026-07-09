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

## Optional: Google OAuth (Better Auth)

The login form exposes a Guest | Sign in tab. Guest play works without any of
the env vars below. To activate Google sign-in, configure the Convex
deployment and the Next.js app:

1. In the Convex dashboard (or `npx convex env set ...`), set:

   ```
   SITE_URL=http://localhost:3110          # your deployed site URL in prod
   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

2. **In the Google Cloud Console → APIs & Services → Credentials → your OAuth
   client → Authorized redirect URIs**, add:

   ```
   http://localhost:3110/api/auth/callback/google
   https://<your-prod-url>/api/auth/callback/google
   ```

   Without this, the first real sign-in fails with `redirect_uri_mismatch`.
   The value must match `SITE_URL + /api/auth/callback/google` exactly.

3. In `.env.local`, set:

   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3110
   NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
   ```

   `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` defaults to `false` so the Google tab
   stays hidden until the dashboard vars are in place. `googleOAuthReadiness`
   in `app/utils/auth/authConfig.ts` surfaces the state to the UI.

4. Restart `pnpm dev` and run `pnpm convex:codegen` once after pulling the
   new `convex/auth.ts` / `convex/http.ts` so the generated `api.auth` and
   `components.betterAuth` bindings are current.

When the flag is on and Convex is configured, the Sign in tab shows a
"Continue with Google" button. Signing in for the first time claims the
current guest's stats and merges them into the account via
`api.profiles.claimGuestProfile`.
