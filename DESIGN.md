# DESIGN.md — Tic-tac-toe Disappear

> Hard contract for how it looks, reads and moves. Authority: this file >
> `design-arsenal` > `AGENTS.md`. Mechanism — what runs, in what order, and the
> traps — is [ARCHITECTURE.md](ARCHITECTURE.md).
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
- Player colours are one palette (`src/game/palette.ts`, mirrored as tokens in
  `index.css`, drift-tested): the chip colour is the identity and the dark mark,
  a hue-matched darker mark sits on the light well, and yellow carries a thin
  darker casing there because a pale yellow cannot clear 3:1 on near-white
  without going olive. Orange and yellow are never each other's opponent.
  Colours tint the start CTA and current-turn chrome, not the whole app

## Symbols

Eight outline symbols (X, O, triangle, square, diamond, star, crescent, heart),
one stroke weight, drawn once in `src/game/shapeGeometry.ts` and used by the
board, the HUD and the pickers (SVG) and by the living field (canvas). Sized
optically, not mechanically: every shape's longest side sits between 56 and 74
units of a 100-unit grid, the triangle is nudged up so its mass does not sink,
and the X is drawn a quarter heavier because its strokes cross. The crescent
replaced the hexagon: the set had five angular shapes and few round ones, and
a regular polygon read as filler. Round joins, round caps, true arcs: crisp at
any pixel density, since SVG is resolution independent and a 2x screen simply
has more pixels to draw the same path.

## Surfaces

| Token | Job |
|---|---|
| `glass` | Lobby card, sheets, dialogs. Calm. No rotating border. |
| `glass-interactive` | Buttons and tappable tiles. One authored moment: specular sweep. |
| `glass-cell` | Board cells, compact chips. No backdrop-filter. |
| `glass-well` | Board well. Largest object. Cells sit *in* it. Frosted harder than `glass` (blur 24px, tint 0.8 light / 0.64 dark) so the symbol field reaches the cells as haze, never as drawn shapes. The one backdrop blur under the board; cells stay filter-free. Light tint is cool grey so white cells read as raised tiles. |

Radius map (already in `src/index.css`): md 10 / lg 14 / xl 18 / 2xl 22.
Icon buttons use `rounded-lg`, never `rounded-full`.

## Motion

- Authored moment: glass-interactive sweep + refraction on hover
- Living field: the symbol field is light with memory. Mouse: a spotlight whose
  wake cools symbol by symbol, and a lens push that settles back. Touch has no
  cursor, so it has its own moves: a ring travels out of every tap, and the
  glow leads the fingertip instead of hiding under it. Reduced motion turns the
  field's reveal off
- Game cues: next-to-remove wiggle, timer countdown stroke, piece pop-in
- Durations: 150–250ms micro, 400–600ms glass, timer tied to `TURN_DURATION_MS`
- `prefers-reduced-motion: reduce` zeros animation and glass motion
- `prefers-reduced-transparency: reduce` drops blur

## Anchored panels

Anything that floats off a trigger — the record breakdown is the only one
today — is **measured and placed against the viewport**, never dropped at a
fixed corner of its anchor. `src/lib/panelPlacement.ts` owns the two rules:

- **Flip**: below the trigger, unless that leaves the panel off the bottom and
  there is more room above.
- **Shift**: clamp inside an 8px gutter, so a panel on a right-hand trigger is
  pushed left instead of cut off. The stats chip left-aligns its panel and ran
  14px past a 390px screen; at 320 it was still clipped.

The trigger moves whenever the page scrolls or the window resizes, so placement
is recomputed on both (capture-phase scroll catches nested scrollers). The
panel is `invisible` for the one frame before it has a position, so it never
flashes at the wrong corner. A panel taller than the window is pinned to the
gutter and scrolls inside itself (`max-h-[calc(100dvh-1rem)]`).

**Hover is a pointer capability, not an assumption.** Touch browsers fire a
synthetic `mouseenter` on tap and no matching `mouseleave`, so a hover-driven
panel latches open and the second tap cannot close it. Gate hover on
`(hover: hover) and (pointer: fine)` and let click do the work everywhere else.
Dismissal (Escape) clears the hover state too, or the pointer resting on the
trigger re-opens the panel immediately.

## Lobby

Hairline masthead: GameMark + two-line Syne wordmark, no rules copy (the
settings sheet owns the rules), and exactly one chrome control: the settings
gear. Theme, language and help are not masthead icons; they live in Settings.
Identity is not in Settings either — the player cards below open the Players
form, because "who plays" and "how the app behaves" are two questions and each
gets one surface. "Tic Tac Toe" sits small and muted above a large
"Disappear" whose tail fades toward the card. GameMark is a bold "XO"
lockup: the X knocks a gap out of the O, which fades toward the wordmark
like the word. Never concentric (an X in a ring reads as a close button).
No literal mini-board: it read as clip art.
`public/favicon.svg` is the same mark.
No uppercase eyebrow. Modes are a 3-up radio, not three equal glass
marketing cards. Start CTA tints to the player's color.

## Onboarding

First run only: welcome, profile, practice round, ready. Same card, header and
pinned thumb-zone action as the lobby, so the handoff into it is invisible.

References: Apple Setup Assistant (one decision per screen, every default
already usable, "set up later" always present), Duolingo's first lesson (you
learn by doing inside the first minute, progress is always visible), Chess.com
lessons (the board is the lesson; the guide sits above it and never competes
with it). Craft move: the piece teaches, not the paragraph. The oldest mark
blinks, then fades out as a ghost; each coach line only names what just
happened, one idea at a time.

- The profile preview tile is the feedback loop: it remounts and pops on every
  pick. The mark meter shows the three-mark limit as three pips
- Syne stays on the wordmark only. Step titles are Source Sans
- Skip is always one tap away and is never styled as a failure
- The practice opponent is never gray, and never shares the player's symbol

## Operate (in-game)

PlayersPanel is HUD, not a second hero. Sentence-case mode label. The
board well dominates the column. Help is a sheet, not a new page, and it is
reached through Settings rather than a HUD icon: one entry point beats four.
Online status banners sit above the board so connection state is first.

### Play while you wait

References: Apple Music's mini player (a persistent one-line status that never
owns the screen), League of Legends' queue pop (a hard interrupt you cannot
miss or mis-tap through), Lichess's lobby (you can play while a seek is open).
Craft move: the interrupt is a freeze, not a countdown. The match-found
overlay lasts exactly as long as connecting does, so the real game's clock
never starts on a screen the player is still looking at.

- The search card offers the computer as its one primary action: difficulty
  chips, then the tinted CTA, then the reassurance that the place in line is
  kept. Cancel stays last and quiet
- During play the search shrinks to a single glass strip above the board:
  spinner, who is looking, Leave queue. It never competes with the board
- When the search ends the strip becomes the reason plus Search again; the
  game on the board is never taken away
- Copy must survive a longer translation: the CTA's height is a floor, so
  Spanish wraps to two lines at 320px instead of clipping
- A created room gets the same offer in its own card under the room code, so
  the code and Copy link stay on screen; the card says the room stays open.
  Its strip carries Share (phone) or Copy link beside Close room, because the
  friend may not have the link yet, and the copy confirmation borrows the
  strip's detail line instead of adding a second live region
- The handoff overlay is announced as "Opponent joined" for a room and
  "Opponent found" for a search; the freeze behaves identically

## Mobile (below `sm`, 640px)

A phone is not a small desktop. Desktop keeps the floating glass column;
a phone gets a native screen. Everything below is `max-sm:` (or base +
`sm:` restoring desktop), so the 1280px view does not move.

References: iOS full-screen sheets (title bar, scrolling body, sticky
action), NYT Games mobile web (board first, thin chrome), Chess.com mobile
(players hug the board, actions in a bottom bar). Craft move: the thumb
zone. Primary actions live at the bottom edge with
`pb-[max(1rem,var(--inset-bottom))]`.

- **Shell**: full-bleed. `#main-content` pads only the safe-area insets;
  each surface brings its own `px-4` gutter and fills the height.
- **Lobby**: no card on phones. Masthead on top, modes as a vertical radio
  list, the Start CTA pinned at the bottom with its disabled reason under it.
- **Forms are pages**: every overlay is `components/ui/sheet.tsx`. Phone
  `size="full"` is a full-height page that slides up, swipe-down on its
  header dismisses, the primary action sits in the sticky footer. Short
  decisions (confirms) use `size="auto"`, a bottom action sheet. Desktop
  renders the same Sheet as a centered dialog.
- **Appearance pickers** keep Color and Symbol as a paired row of taller,
  icon-led controls. The chosen color fills its tile — no check mark; the
  filled tile plus its ring is the selection signal. The chosen symbol is
  centered in its tile. Tapping either expands its full
  options below. AI difficulty remains an always-open segmented choice.
- **Game**: status + timer on top, player strip, the board as hero, then a
  bottom action bar of labelled buttons (Settings, Edit, New game, Exit).
  Settings is the app preferences and Edit is identity: two controls because
  they are two jobs. The Help control is the one that went, since Settings owns
  the rules; a guest online gets no Edit, because the host assigns symbols. The
  HUD box dissolves (`max-sm:contents`) and `order` stacks its rows around
  the board.

### Win state

**The winner's own colour says who won.** A finished game paints its three
winning cells in the colour of the player who owns them (one step up from the
occupied-cell tint), and the same colour marks their card and tints "Play
again". No fixed green: green meant "someone won" and never said who, so the
one surface whose job is to name a player was the only one not using that
player's identity.

- **A crown on the winner's card is the status**, arriving with the line's
  flourish. Colour alone is never the signal (same rule as amber and red).
- **The sentence is announced, not printed.** "Ada wins!" is rendered
  screen-reader-only: the line and the crown already say it, in Ada's colour,
  and a second copy in nobody's green competed with them.
- **One flourish, 420ms.** The winning line pulses once (`win-claim`) and the
  crown pops (`crown-pop`), both stopped by `prefers-reduced-motion`. The
  resting border and tint carry the state for anyone who never sees the motion.
- **A draw stays neutral.** No crown, no tint: the win surfaces key on the
  winner's colour, so there is nothing to wear when nobody won.
- **Minimums**: 12px text (14px for anything read), 44px targets, 48px
  primary CTAs, 16px inputs (iOS zoom), `no-touch-select` on the board.
- Short landscape (`landscape-short:`) is wider than `sm`, so it keeps the
  desktop HUD beside the board.
