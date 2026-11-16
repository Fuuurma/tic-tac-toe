# TTT-PROMO-VIDEO1 — launch promo video

Two cuts of a 20.7 s launch promo, built with Remotion from scripted captures of
the real app (the build of `main` at the time of capture, against the local
matchmaking Worker). Silent, with captions. Everything lives in `promo/`, its own
pnpm root; the app's bundle, lint, tests and build never read it.

| Cut | File | Spec |
|---|---|---|
| Vertical | `promo/out/ttt-promo-vertical-1080x1920.mp4` | 1080x1920, 30 fps, h264, 621 frames, 20.7 s |
| Square | `promo/out/ttt-promo-square-1080x1080.mp4` | 1080x1080, 30 fps, h264, 621 frames, 20.7 s |

Stills (both cuts, `promo/out/stills/`): `*-0.0s.png` the hook's first frame,
`*-9.6s.png` the win, `*-20.0s.png` the end card. `pnpm stills` regenerates them.

## Cut

| Time | Scene | Caption |
|---|---|---|
| 0.0–2.5 s | Hook: the board fills the frame and a mark vanishes about 1 s in. Frame 0 is already a finished thumbnail. | Tic-tac-toe / but your marks disappear. |
| 2.2–10.6 s (1.31x) | vs Computer, HUD and board, through the win: winning line in the winner's colour, crown, record. | Play the computer / Three marks each. / The oldest one fades. / Line up three. Win. |
| 10.4–17.4 s (1.16x) | Online: Online, Create, Create Room, Room ready with the 6-character code, Copy invite link; the friend joins from that link; first moves. A camera pans to each tap. | Play a friend online / Open a room. / Send the link. / They’re in. Your move. |
| 17.1–20.7 s | End card: the XO mark, the Syne wordmark, the URL. | Free. No sign-up. In your browser. / tic-tac-toe-1ou.pages.dev |

Scenes crossfade over 8 frames. Scene timing is derived from the capture logs (`promo/public/captures/*.json`),
so a re-capture re-times the captions instead of leaving them on stale moments.

## Design contract (DESIGN.md)

- Syne on the wordmark only; captions and URL in Source Sans 3. Both faces are
  the app's own self-hosted files, copied by `promo/scripts/sync-brand.mjs`.
- Brand cyan `oklch(0.55 0.16 205)` / dark ring `oklch(0.7 0.12 205)`; X blue
  `#007df3`, O red `#f53131` from `src/game/palette.ts`; dark theme page colour.
- Sentence case, no uppercase kickers, no em dashes in on-screen copy.
- Motion is transform and opacity only, one ease-out curve, 400 ms entrances,
  quicker exits, end-card elements staggered.

## Licence

Remotion 4.0.543's `LICENSE.md` grants the Free License to "an individual" for
commercial or non-commercial video creation; Furma posting as a solo individual
is inside it. Recorded in `promo/README.md`. No audio, so no audio licence.

## Verification

- Root gates on the tree rebased onto `f75af60`: `pnpm lint` clean; `pnpm test`
  991/991 in 86 files; `pnpm build` green (`tsc -b && vite build`).
- `promo`: `pnpm typecheck` (tsc, strict) clean before every render.
- Renders made with the project's own scripts (`pnpm render:vertical`,
  `pnpm render:square`), every heavy step through the sf-orch lease.
- `ffprobe` on both outputs: duration 20.7 s, 1080x1920 and 1080x1080, h264,
  each under 5 MB (limit 20 MB). Capture clips 2.9 MB and 3.3 MB.
- Frames reviewed as contact sheets at 1.5 fps after each render. Fixed during
  review: captions fell back to a serif because an unquoted
  `Source Sans 3 Variable` is invalid CSS; "Disappear" overflowed the end
  card; the hook headline crossed the next caption during the crossfade; the
  online camera followed a board tap and cut the player cards; the square
  phone was too small to read; the vertical crop clipped the board well once
  FIX3 moved it; replacing headlines landed a few frames after their moment.

## Capture notes

- The first capture stalled 9 s mid-game: a synchronous write per 3x
  screencast frame starved Node, so Playwright fell behind the page. Frames
  are now acked first and written asynchronously, and Chrome scales them to
  1080 wide at the source.
- Screencast frames arrive only when the page paints, often faster than
  30 fps; clamping each to 1/30 s stretched a 34 s take to 63 s. Frames are
  now resampled to a constant 30 fps by their timestamps.
- Re-captured twice as `main` moved: persona names for the computer
  (TTT-NPC-NAMES1), short friend-room codes (TTT-UX-FIX2), the HUD text floor
  (TTT-UX-FIX3) and the "Try Normal next" win action (TTT-UX-FIX4) are all on
  camera, so the video shows the app as it launches.

## Open

- Captures reflect `main` as of this commit; a visible UI change later means
  `pnpm capture` and `pnpm render` again (README has the steps).
- Silent by design. A platform that wants audio needs a track picked at
  upload time.
