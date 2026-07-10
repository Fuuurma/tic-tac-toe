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
   git push origin feat/game-stack-vite-peerjs
   ```

2. **Create Cloudflare Pages project**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create
   - Connect your GitHub repo
   - Framework preset: **None**
   - Build command: `pnpm build`
   - Build output directory: `dist`
   - Click Deploy

3. **Environment Variables** (optional, for production PeerJS)
   In the Pages project → Settings → Environment variables:
   ```
   VITE_PEERJS_KEY=<your-peerjs-key>   # Register at peerjs.com for a key
   ```
   Without this, the public PeerJS broker is used (rate-limited, fine for demo).

4. **Smoke the live URL**
   ```bash
   E2E_BASE_URL=https://<your-project>.pages.dev pnpm test:e2e
   ```

## Local preview

```bash
pnpm build
pnpm preview     # serves dist/ on localhost:4173
```

## Troubleshooting

### Build fails
- Ensure pnpm is available: `corepack enable`
- Check that all dependencies are in `package.json`

### PeerJS connection fails in production
- Ensure `VITE_PEERJS_KEY` is set in the Pages environment variables
- Check the browser console for PeerJS connection errors
- The public broker has rate limits; a registered key is recommended for prod
