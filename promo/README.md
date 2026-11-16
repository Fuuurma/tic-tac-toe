# Promo video

Launch promo for Tic Tac Toe Disappear, built with [Remotion](https://www.remotion.dev)
from scripted captures of the real app. Two cuts render from one composition:

| Cut | File | Size |
|---|---|---|
| Vertical (Reels, TikTok, Shorts, Stories) | `out/ttt-promo-vertical-1080x1920.mp4` | 1080x1920, 30 fps, h264 |
| Square (feed posts) | `out/ttt-promo-square-1080x1080.mp4` | 1080x1080, 30 fps, h264 |

Silent by design, with captions; social feeds autoplay muted, and that leaves
no audio licence to track. Add a track at upload time if a platform asks for one.

This folder is its own pnpm root (`pnpm-workspace.yaml` here) with its own
lockfile. Nothing in it is imported by the app, and the app's lint, tests and
build never read it.

## Licence

Remotion is source-available, not MIT. Its licence
(`node_modules/remotion/LICENSE.md`, Remotion 4.0.543, checked 2026-11-16)
grants the **Free License** to "an individual", "a for-profit organization
with up to 3 employees", non-profits, and anyone evaluating it, and allows use
"non-commercially or commercially for the purpose of creating videos". Furma
publishing this as a solo individual is inside that grant. A Company License
is needed only if the project becomes a for-profit organisation with more than
three employees. Re-read the licence if Remotion moves to 5.0; it says the
terms change then.

Fonts are the app's own self-hosted Syne and Source Sans 3 (SIL Open Font
License), and the mark is the app's favicon.

## Make it

From this folder, with the Worker running on `127.0.0.1:8787` (the online
clip needs a real room):

```bash
pnpm install
# 1. Build the app against the local Worker (repo root, not this folder)
(cd .. && VITE_MATCHMAKING_URL=http://127.0.0.1:8787 pnpm build)
# 2. Record the gameplay: public/captures/*.mp4 and their *.json timing logs
pnpm capture               # or: pnpm capture vs-computer | online-invite
# 3. Copy the mark and fonts from the app, then render both cuts
node scripts/sync-brand.mjs
pnpm render
# 4. Review stills: out/stills/*.png
pnpm stills
```

`pnpm studio` opens the Remotion editor for scrubbing.

## How it is put together

- `capture/capture.mjs` drives `vite preview` of the repo's `dist/` in a
  390x844 phone viewport at 3x, dark theme, and records with the DevTools
  screencast. The easy computer is seeded so a take repeats; the script keeps
  the first take where a mark vanishes before the win, so the hook has its
  moment. The online clip opens a real room on the local Worker, and a second
  browser joins through the invite link the host copied. Frames are resampled
  to a constant 30 fps by their capture timestamps. Every tap and key moment
  is logged to `<clip>.json`, and the video draws a fingertip ring at each tap.
- `src/timeline.ts` times the cut from those logs, so a re-capture re-times
  the captions instead of leaving them pointing at moments that moved.
- `src/layout.ts` holds the geometry of each cut; `src/Promo.tsx` is the
  sequence: hook (board zoom, the vanish), vs computer through the win,
  online room and invite (a camera that pans to each tap), end card with the
  URL.
- Brand values in `src/brand.ts` come from `DESIGN.md` and
  `src/game/palette.ts`; `scripts/sync-brand.mjs` copies the mark and fonts.
