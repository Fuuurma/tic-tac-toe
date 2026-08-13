# DESIGN.md — Tic-tac-toe Disappear

> Hard contract. Authority: this file > `design-arsenal` > `AGENTS.md`.

## Direction

**Liquid glass game** — Apple-adjacent materials, but a *loaded* display face
and a non-indigo primary. Glass is the material; type is the identity.

### References
- Apple product pages — material, not decoration
- tic-tac-toe board craft (own `BackgroundPattern`) — keep
- Raycast — dark tool chrome

### NEVER
- System-ui only (no font load)
- Indigo `oklch(… 264)` as player/brand primary
- Purple player chrome by default
- Glass + `rounded-full` on every control

### MUST
- Load one display + one body face in `index.html` / CSS
- Reduced-motion collapses glass motion
- Board is the hero; chrome recedes

## Type and color

- Display: **Syne** (self-hosted `@fontsource-variable/syne`)
- Body: **Source Sans 3** (self-hosted `@fontsource-variable/source-sans-3`)
- Brand primary / ring: cyan `oklch(… 205)`, not indigo 264
- Player color tokens stay as-is; they are identity, not brand chrome
