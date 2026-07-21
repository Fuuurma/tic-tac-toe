# Deployment Guide — Cloudflare Pages

## Quick Deploy (Recommended)

### Prerequisites
- [Cloudflare account](https://dash.cloudflare.com)
- [GitHub repository](https://github.com) with your code

### Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "deploy: ship first slice"
   git push origin main
   ```

2. **Create Cloudflare Pages project**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create
   - Connect your GitHub repo
   - Framework preset: **None**
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Click Deploy

3. **Smoke the live URL**
   ```bash
   E2E_BASE_URL=https://<your-project>.pages.dev pnpm test:e2e
   ```

### Quick Match (optional)

The "Quick" button in the Online game mode requires a Cloudflare
Worker for matchmaking (POST /join, GET /poll, POST /leave). The
client hits `${VITE_MATCHMAKING_URL}/api/matchmaking/tictactoe/...`
and falls back to `http://localhost:8787` in dev.

1. **Deploy the matchmaking Worker** (separate Cloudflare Worker).
   The expected contract is in `src/lib/matchmaking.ts`:
   - `POST {baseUrl}/api/matchmaking/:game/join` → `{ status: "waiting", ticket, roomId } | { status: "matched", match: { roomId, role, host, guest } }`
   - `GET  {baseUrl}/api/matchmaking/:game/poll?ticket=...` → same response shape
   - `POST {baseUrl}/api/matchmaking/:game/leave` body `{ ticket }`
   The Worker pairs two `join` requests with the same `game` and
   returns a matched room.

2. **Set the env var on the Pages project** (Settings →
   Environment variables):
   ```
   VITE_MATCHMAKING_URL=https://your-matchmaking-worker.workers.dev
   ```

   Without this, the Quick button falls back to
   `http://localhost:8787` (dev only) and won't work in production.

3. **Room ID URL pre-fill** (optional)
   The app reads `?room=<id>` from the URL and pre-fills the Join
   screen. Generate share links from the in-app "Copy invite link"
   button — they already encode the room.

## Local preview

```bash
pnpm build
pnpm preview     # serves dist/ on localhost:4173
```

## Troubleshooting

### Build fails
- Ensure pnpm is available: `corepack enable`
- Check that all dependencies are in `package.json`

### WebSocket relay connection fails
- Check the browser console for WebSocket errors
- Confirm the Durable Object relay Worker is deployed and reachable
- Test from two genuinely different networks, not only two tabs on one machine
- The room keeps a 30-second reconnect window; check that both clients reconnect within that window
