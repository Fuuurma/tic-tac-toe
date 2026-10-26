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
- Living field: the symbol field is light with memory. Mouse: a spotlight whose
  wake cools symbol by symbol, and a lens push that settles back. Touch has no
  cursor, so it has its own moves: a ring travels out of every tap, and the
  glow leads the fingertip instead of hiding under it. Reduced motion turns the
  field's reveal off
- Game cues: next-to-remove wiggle, timer countdown stroke, piece pop-in
- Durations: 150–250ms micro, 400–600ms glass, timer tied to `TURN_DURATION_MS`
- `prefers-reduced-motion: reduce` zeros animation and glass motion
- `prefers-reduced-transparency: reduce` drops blur

## Lobby

Hairline masthead: GameMark + two-line Syne wordmark, no rules copy (Help
owns the rules). "Tic Tac Toe" sits small and muted above a large
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
board well dominates the column. Help is a sheet, not a new page.
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
  bottom action bar of labelled buttons (Help, Edit, New game, Exit). The
  HUD box dissolves (`max-sm:contents`) and `order` stacks its rows around
  the board. Game over tints "Play again" and lifts the result to `text-xl`.
- **Minimums**: 12px text (14px for anything read), 44px targets, 48px
  primary CTAs, 16px inputs (iOS zoom), `no-touch-select` on the board.
- Short landscape (`landscape-short:`) is wider than `sm`, so it keeps the
  desktop HUD beside the board.
