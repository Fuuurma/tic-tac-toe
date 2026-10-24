# Deployment Guide — Cloudflare Pages

## Release deployment

### Prerequisites
- [Cloudflare account](https://dash.cloudflare.com)
- Wrangler authentication for the Cloudflare account that owns the existing
  `tic-tac-toe` Pages project

### Steps

1. **Validate and push**
   ```bash
   pnpm check
   git push origin main
   ```

   The default local browser run covers the shell, local play, and AI. Before
   release, also run the two-session online specs with the local Worker and
   preview running, then repeat them against the deployed URL.

2. **Deploy the existing Pages project**
   ```bash
   VITE_MATCHMAKING_URL=https://fuurma-matchmaking.sergiformatjer1999.workers.dev pnpm deploy
   ```

   `pnpm deploy` builds the static bundle locally, then uploads it with
   Wrangler. The matchmaking URL must be present during that local build;
   changing a variable in the Pages dashboard does not rewrite an uploaded
   JavaScript bundle. The deploy script marks its preflight as a Pages build,
   so it refuses to upload a bundle that still points at localhost.

   A Git push is not deployment proof. Confirm that Wrangler reports a new
   production deployment for the `tic-tac-toe` project:
   ```bash
   pnpm exec wrangler pages deployment list --project-name tic-tac-toe
   ```

3. **Smoke the live URL**
   ```bash
   E2E_BASE_URL=https://<your-project>.pages.dev pnpm test:e2e
   ```

### Quick Match (optional)

The "Quick" button in the Online game mode requires a Cloudflare
Worker for matchmaking (POST /join, GET /poll, POST /leave). The
client hits `${VITE_MATCHMAKING_URL}/api/matchmaking/tictactoe/...`
and falls back to `http://127.0.0.1:8787` in dev.

1. **Deploy the matchmaking Worker** (separate Cloudflare Worker).
   The expected contract is in `src/lib/matchmaking.ts`:
   - `POST {baseUrl}/api/matchmaking/:game/join` → `{ status: "waiting", ticket, roomId } | { status: "matched", match: { roomId, role, host, guest } }`
   - `GET  {baseUrl}/api/matchmaking/:game/poll?ticket=...` → same response shape
   - `POST {baseUrl}/api/matchmaking/:game/leave` body `{ ticket }`
   The Worker pairs two `join` requests with the same `game` and
   returns a matched room.

2. **Point the build at the Worker.** `.env.production` (tracked)
   sets `VITE_MATCHMAKING_URL` to the production Worker, so a git-push
   build is self-contained.

   Do **not** rely on Pages project env vars for this: on a
   wrangler-configured Pages project (`wrangler.jsonc` +
   `pages_build_output_dir`), `plain_text` variables never reach the
   build environment — the build log reads "Build environment
   variables: (none found)" and the bundle bakes nothing (that was
   incident F774). Only `secret_text` vars reach the build there; the
   URL is public anyway, so the committed file is the honest place
   for it. If the URL changes, edit `.env.production` and
   `public/_headers` (connect-src) in the same commit.

   Without the variable, the Quick button falls back to
   `http://127.0.0.1:8787` (dev only) and won't work in production.

3. **Room ID URL pre-fill** (optional)
   The app reads `?room=<id>` from the URL and pre-fills the Join
   screen. Generate share links from the in-app "Copy invite link"
   button — they already encode the room.

## Local preview

```bash
VITE_MATCHMAKING_URL=http://127.0.0.1:8787 pnpm build
pnpm preview     # serves dist/ on 127.0.0.1:3110
```

The preview bundle bakes `VITE_MATCHMAKING_URL` at build time.
`.env.production` already carries the production Worker, so export the
variable only when the preview should talk to the sibling matchmaking
Worker on `:8787` instead of production.

The deploy command runs `deploy:check` (build + dist preflight) and then
`wrangler pages deploy dist`. It requires
Wrangler authentication. The project name in `wrangler.jsonc` is
`tic-tac-toe`.

## Troubleshooting

### Build fails
- Ensure pnpm is available: `corepack enable`
- Check that all dependencies are in `package.json`

### WebSocket relay connection fails
- Check the browser console for WebSocket errors
- Confirm the Durable Object relay Worker is deployed and reachable
- Test from two genuinely different networks, not only two tabs on one machine
- The room keeps a 30-second reconnect window; check that both clients reconnect within that window
