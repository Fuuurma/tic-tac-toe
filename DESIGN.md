# DESIGN.md — Tic-tac-toe Disappear

> Hard contract. Authority: this file > `design-arsenal` > `AGENTS.md`.
> Before UI: 3 named references + 1 craft move.

## Direction

**Liquid glass game** — Apple-adjacent materials, Raycast-quiet chrome, a
*loaded* display face. Glass is the material. Type is the identity. The
board is the product.

Craft move: recede chrome. Syne appears on the wordmark only. HUD, buttons,
and labels stay Source Sans 3. The 3×3 well is the largest, darkest, most
in-focus object on the operate surface.

### References
- Apple product pages — material, not decoration (frost, rim, sheen)
- Own `BackgroundPattern` board craft — keep the living symbol field
- Raycast — dark tool chrome that does not compete with the artifact

### NEVER
- System-ui only (no font load)
- Indigo `oklch(… 264)` as player/brand primary
- Purple player chrome by default (`--player-color` defaults to X blue)
- Glass + `rounded-full` on controls (pills are for color dots and sheet grabbers)
- Uppercase tracking kickers above the wordmark
- Em dashes in user-facing copy
- Display face on buttons, labels, data, or HUD

### MUST
- Self-host Syne (display) + Source Sans 3 (body); CSP `font-src 'self'`
- Brand primary / ring: cyan `oklch(… 205)`
- Reduced-motion collapses glass sweep, border rotation, and piece motion
- Reduced-transparency collapses blur to an opaque tint
- Board is the hero; chrome recedes
- Default player colors: X blue, O red (purple is a pick, not a default)

## Type and color

- Display: **Syne Variable** 400–800, `font-display`, wordmark only
- Body: **Source Sans 3 Variable** 200–900, `--font-sans` on `html`
- Scale (fixed rem, operate): 11 / 12 / 14 / 16 / 20 / 24
- Numerals in the timer: `tabular-nums` + `font-mono`
- Brand primary / ring: `oklch(0.55 0.16 205)` (dark ring `0.7 0.12 205`)
- Neutrals: cool cyan-gray hue 220, chroma kept low
- Player tokens (`COLOR_RGB`) stay identity; they tint the start CTA and
  current-turn chrome, not the whole app

## Surfaces

| Token | Job |
|---|---|
| `glass` | Lobby card, sheets, dialogs. Calm. No rotating border. |
| `glass-interactive` | Buttons and tappable tiles. One authored moment: specular sweep. |
| `glass-cell` | Board cells, compact chips. No backdrop-filter. |
| Board well | Dark inset square. Largest object. Cells sit *in* it. |

Radius map (already in `src/index.css`): md 10 / lg 14 / xl 18 / 2xl 22.
Icon buttons use `rounded-lg`, never `rounded-full`.

## Motion

- Authored moment: glass-interactive sweep + refraction on hover
- Game cues: next-to-remove wiggle, timer countdown stroke, piece pop-in
- Durations: 150–250ms micro, 400–600ms glass, timer tied to `TURN_DURATION_MS`
- `prefers-reduced-motion: reduce` zeros animation and glass motion
- `prefers-reduced-transparency: reduce` drops blur

## Lobby

Hairline masthead: GameMark + Syne wordmark + one sentence of rules.
No uppercase eyebrow. Modes are a 3-up radio, not three equal glass
marketing cards. Start CTA tints to the player's color.

## Operate (in-game)

PlayersPanel is HUD, not a second hero. Sentence-case mode label. The
board well dominates the column. Help is a sheet, not a new page.
Online status banners sit above the board so connection state is first.
