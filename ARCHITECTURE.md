# tic-tac-toe — Architecture

Guest-first online tic-tac-toe: React 19 (Vite 8) SPA deployed to
Cloudflare Pages (`wrangler pages deploy dist`). The game core is pure and
self-play-tested (`src/game`: rules, AI with behavior/selfplay/bench
suites); identity is generated locally so play never requires an account.
Online rooms go through the shared `fuurma-matchmaking` Worker (quick-match
pairing + `GameRoomDO` WebSocket relay); host-authoritative validation runs
client-side in `src/lib/peer.ts`.

**Scope.** This file is mechanism: what runs, in what order, and the traps. Visual
intent and user-facing copy live in [DESIGN.md](DESIGN.md); how to work in the
repo lives in [AGENTS.md](AGENTS.md). A fact that is a rendering or wording
decision belongs there, not here.

The architecture, drawn: **[diagrams/architecture.html](diagrams/architecture.html)**
(diagram-design editorial HTML — refresh it when modules or data flows change;
never redraw it as Mermaid). It keeps both paths: guest identity into the
React UI, hooks, and the pure game engine for local play, and the UI through
the host-authoritative peer room and matchmaking client onto the external
`fuurma-matchmaking` relay for online rooms.

## Modules

The layers only point one way: `components → hooks → lib → game`. There are
zero upward imports (`game` imports nothing from lib/hooks/components, `lib`
imports no hook or component), which is what keeps the engine testable without
a DOM and the protocol testable without React.

- src/game — pure engine, React-free by test: logic.ts rules, ai.ts (easy random / normal d4 / hard d8 alpha-beta; behavior + selfplay + bench suites), turnClock.ts (the freeze/rebuild pair), palette.ts, shapeGeometry.ts, tutorial.ts, constants
- src/lib/peer.wire.ts — the wire union, the scalar bounds and the validators (`isPeerMessage`, `isGameState`); the trust boundary, no user copy
- src/lib/peer.apply.ts — the pure state transitions over an admitted frame (`applyAuthorizedMove`, `applyHostGuestJoin`, `applyForfeitIfActive`)
- src/lib/room-protocol/ — the host/guest protocol state machine: message handling, room lifecycle, relay events, the turn timer, and `state.ts` (the `PeerRoomState` vocabulary). Not a hook — nothing here calls React
- src/hooks — React hooks only: usePeerRoom (wires the protocol to React), useLocalGame, useGameStats, usePlayerCount, useAppTheme
- src/lib/matchmaking.ts — relay URL acquisition and the quick-match queue client
- src/lib/roomClient.ts + roomId.ts — room socket wrapper and room id helpers (`generateRoomId`, `ROOM_ID_PATTERN`)
- src/lib/identity.ts — generated guest identity, localStorage-backed
- src/lib/storage.ts — the one browser-storage guard (SSR and private-mode safe)
- src/components — game board and lobby surfaces
- src/components/backgroundField.ts — the heat-field model for `BackgroundPattern`; the one pure module kept beside its single consumer
- src/components/game/queuePlay.tsx — play the computer while a quick-match search runs or a created room waits (invite, wait strip, warm-up game, opponent-found handoff); shares `LocalBoard` and `useRecordLocalResult` with the local surface
- src/lib/room-protocol/waitPhase.ts — pure derivation of the wait phase (`searching | matched | ended | null`) for Quick (from `PeerRoomState.queue`) and a created room (from its connection states)
- e2e/ — Playwright smoke tests
- deploy — `wrangler pages deploy dist` (Cloudflare Pages)
- fuurma-matchmaking (separate Worker) — pairing + GameRoomDO relay; not in this repo

## Data flow

Guest never writes game state. The host owns it:

```
guest tap ─▶ send { type: "move", index }
             └─ host validates (isValidMove, bounds, turn) ─▶ makeMove
                └─ broadcast { type: "gameUpdate", gameState }  (budget only, no deadline)
                   └─ guest applies it, or rolls back its optimistic mark on { type: "error" }
```

Local play skips the wire entirely and commits through `commitLocalMove`. Both
paths end in the same `src/game/logic.ts` transitions, which is why the rules
have exactly one implementation.

The layers only point one way — `components → hooks → lib → game` — with zero
upward imports, which is what keeps the engine testable without a DOM and the
protocol testable without React.

## How the game behaves

Everything from here down is how it works and why. The visual contract is
[DESIGN.md](DESIGN.md); this file is the behaviour.

## Game rules

- 3-piece strategic variant: max 3 pieces per player, oldest auto-removed on 4th
- 10s turn timer; on timeout, random legal move
- Win detection: 3 in a row/column/diagonal

## Game rules and constants (values)

- `TURN_DURATION_MS = 10_000` (10s per turn)
- `GAME_RULES.MAX_MOVES_PER_PLAYER = 3`
- `BOARD_SIZE = 9`
- AI difficulties: EASY (weighted random with center/corner preference), NORMAL (depth-4 eviction-aware alpha-beta Minimax with randomized equal-score choices), HARD (depth-8 cycle-safe alpha-beta Minimax with stable best play)
- Helpers in `constants.ts`: `oppositeSymbol(symbol)`, `randomPlayerSymbol()`, `oppositeColor(color)` — use these instead of inline ternaries

## Online Match Modes

- Three entry points, three different contracts. **Quick** is paired by the matchmaking service, **Create** mints a room the user invites a specific person to, **Join** consumes a code they were sent. Room codes belong to Create and Join only
- Quick Match must never surface a room code — not as the share banner while searching, not as the HUD's copyable chip during play, and not in the "no opponent found" error. A quick-match room is an internal pairing detail; publishing it hands out a join key for a match nobody asked to be in. It leaked in all three places before, which is what `onlineGameSurface.test.tsx`'s "room-code disclosure" block now pins shut
- The live population comes from `GET /api/matchmaking/{game}/health` (`{ ok, game, waiting, matches }`), which the Worker already served — no Worker deploy was needed. `players = waiting + matches * 2`
- `usePlayerCount` lives in a module-level store behind `useSyncExternalStore`, not component state: polling is not a render concern, and the lobby and the online surface both read it. It never reports 0 before its first successful read — a confident "0 players" next to Quick Match reads as "nobody is playing" and talks people out of pressing it. A failed refresh keeps the last good value and backs off; the poll pauses while the tab is hidden
- Every online entry point shares one backend gate. The HTTP calls and `buildRoomWsUrl` resolve their base through `resolveBaseUrl`, which refuses (`ONLINE_UNAVAILABLE`) in a production build with no `VITE_MATCHMAKING_URL`, and the lobby disables Quick, Create and Join with the same "Online play isn't available in this build." copy. Local dev falls back to `127.0.0.1:8787`, so only Quick Match stays blocked there
- A quick-match poll can answer `matched` with `role: "guest"` and the OPPONENT's `roomId`, after a `waiting` response that carried the joiner's own room (the Worker's room bind failed at join time). Seat by `match.role` and `match.roomId`, never by the waiting response
- Create expects the `host` seat. The relay seats a creator as `guest` when the code already has a host, and `welcome.role !== "host"` on a host client is reported as "That room code is already in use" with the socket closed
- The Worker's queue already matched pairs FIFO on a `waiting` response that carries the room id, so the client still hosts a relay room while searching. That is transport, not a feature — suppressing the code is a UI decision, not a protocol one

## Play While You Wait (Quick Match and a created room)

- `PeerRoomState.queue` (`none | searching | matched`) is the one signal for where a Quick Match is. `status` cannot say it: a searcher polling the queue and a paired host building its room both hold `creating`, and the queue-depth copy used to hang off `waiting`, so it never showed during a real search. `runQuickMatch` sets `searching` first, `matched` before it calls `startAsHost`/`joinAsGuest`, and `none` on every way out (timeout, expired ticket, failure, pagehide, `leave()`). A new exit path that forgets `queue: "none"` strands the search UI
- A searching player, or the host of an open room, may fill the wait with a vs Computer game (`src/components/game/queuePlay.tsx`). It is opt-in, never offered to a guest joining a room (their host is already there or the join fails fast), and purely local: the ticket keeps polling, or the room's socket stays open, in `usePeerRoom` the whole time, so playing never costs the place in line or the room. Difficulty defaults to the saved preference and is saved when changed
- `waitPhase` (`src/components/game/waitPhase.ts`, pure and unit-tested) derives the one phase the surface keys on: `searching`, `matched`, `ended`, or none once the online game exists. Quick reads `PeerRoomState.queue`. A created room has no queue, so its host reads the connection states: `waiting` (and `reconnecting`, the code still works) is `searching`, `connecting` (written by `peer-joined`, before the guest's `join` frame) is `matched`, `error`/`disconnected` is `ended`, and any game status past `WAITING` is none. The cards, the one-line `QueueStrip`, the handoff and the warm-up all key on it. The warm-up lives while the phase does, so a search that expires, or a room that closes, mid-game keeps the board; the online board replaces it only when the game is `connected`. While the warm-up is up the online board is suppressed even through a `reconnecting` blip, so an empty online board never appears beside it
- A room's strip keeps the invitation one tap away. Its wording and actions are [DESIGN.md](DESIGN.md)'s; the one rule that belongs here is that a room code is still never shown for Quick — a disclosure decision, not a layout one
- The handoff is a freeze, never a timer. On `matched` the warm-up pauses under an overlay that blocks the board, so a tap meant for the old game cannot land on the real one, and it stays until the connection is up. The real game's turn clock starts at `connected`, so nobody loses seconds to the swap, and no artificial delay is added to it
- Warm-up results are recorded like any vs Computer game (`useRecordLocalResult`, shared with `LocalGameSurface`); an abandoned or frozen game records nothing. The board wiring is `LocalBoard`, shared for the same reason, so the two screens cannot drift on when a cell is dead or what it says

## Relay model and validation

- Default transport is the shared `fuurma-matchmaking` Cloudflare Durable Object WebSocket relay
- The historical `VITE_USE_WS_ROOM=true` flag is removed from `.env.production`; the code always uses WebSockets and there is no non-WebSocket fallback
- Room creator = host, owns game state and timer. The host's symbol (X or O) is randomized at room creation and again on each rematch — use `hostSymbolRef` / `guestSymbolRef` to look up the actual symbol, never hardcode X or O
- Guest sends move intents to host; host validates, applies, and broadcasts state to guest
- Inbound wire frames are validated by `isPeerMessage`/`isGameState` in `src/lib/peer.ts` (colors, display names, move indices, winning lines, timer bounds, game-mode/AI-difficulty/player-type enums)
- Host resets `turnTimeRemaining` to `TURN_DURATION_MS` after `peer-reconnected` so a same-identity reconnect cannot trigger an immediate random move
- Either side may request a rematch: both send `rematchRequested` with their own symbol and arm the same 30s expiry. The host still owns the reset, so it answers a guest request locally (`acceptIncomingRematch`) instead of sending an accept and waiting for its own echo
- The host gates `rematchAccept` on a pending request of its own and on the previous game being terminal; a stray guest accept is ignored. It gates an incoming guest request the same way, and on `guestJoinedRef` so a peer that never joined cannot pop a prompt over live play
- Requesting while a prompt is already up is a no-op on both sides: answering one request and asking another would leave both players waiting
- Forfeit winner is determined by the actual host/guest symbol refs, not hardcoded X/O
- `peer-left: disconnect` is transient during the 30-second reconnect grace; `peer-reconnected` restores the peer; `closed` and `expired` are final

## Resync and rollback

The guest applies its move optimistically and keeps ONE pre-move snapshot
(`pendingGuestStateRef`). The host's authoritative `gameUpdate` clears it; so
does a resync `joined`. An invalid move comes back as `error: "Invalid move"`
and the guest rolls back to that snapshot.

On resync the host sends its current state; the wire carries only
`turnTimeRemaining`, never an absolute deadline (`toWireGameState` strips it), so
the guest rebuilds the deadline on its own clock (`rebuildDeadline`). That is
why a stale host deadline cannot strand a reconnecting guest.

**Why there are no sequence numbers.** The obvious design — the error carries a
seq and the guest keeps per-seq snapshots — only pays off where several actions
can be in flight, so a rejection can name WHICH action failed. Play here is
strict alternation: the guest has exactly one outstanding optimistic move
between its turn starting and the host's echo, so a single snapshot plus
"Invalid move" is unambiguous by construction. Seqs would add protocol surface
and a migration for in-flight peers to solve a state that cannot occur. Revisit
only if this transport is reused for a game with simultaneous actions.

## Local Move Commit

- Every local move commits through `commitLocalMove` (`src/hooks/localTurnTimer.ts`) with a `cur === prev` identity guard, so a decision computed off the post-render `gameStateRef` snapshot can never clobber a newer commit
- An identity mismatch does **not** mean a rival move landed: the turn clock rewrites `turnTimeRemaining` onto a fresh object every second. The AI's move is scheduled 700-1300ms after the turn starts against a 1000ms clock, so roughly half of all AI moves land in the same batch as a tick. `commitLocalMove` therefore takes an optional pure `rebase(cur)` that re-derives the move from whatever actually committed and drops only when a real move took the turn. Dropping there used to strand the AI until the turn expired

## Onboarding behaviour

- A new visitor is one with no `tic-tac-toe:*` key in storage at all (`shouldShowOnboarding`, `src/lib/onboarding.ts`). `App` decides this once, in its initial state, because `getOrCreateGuestIdentity` writes a guest id the moment the lobby mounts and would turn every newcomer into a returning player. Unavailable storage and a `?room=` invite link both skip it: the first could never remember the outcome, the second came to join a room
- Flow: welcome, profile (name, color, symbol), a practice round on the real board, ready. Every screen can be left; `tic-tac-toe:onboarding` records `done` or `skipped` and is never asked twice. The profile is saved when confirmed, not at the end, so skipping the practice keeps what was chosen. Skipping earlier saves nothing
- Replay runs only the practice round (`mode="replay"`), is offered from the lobby's How to play (never mid-game), and leaves the saved profile and the first-run record alone
- The practice round runs on the real engine (`src/game/tutorial.ts`); it decides who the player faces and what to say, never what a move does. The AI blocks the player's winning cell until their 4th mark, so the first vanish is always seen before any win, then looks away. It never wins, and is never gray (gray all but disappears on the board's dark well). `findWinningMove` asks the engine, so a line that needs the mark about to vanish is not offered as a win. The lesson stage is derived from the game, never stored
- `Board`'s `hintIndex` and `showVanish` are opt-in and only the practice round sets them. `showVanish` keeps a retired mark alive as a fading ghost; the real game still removes it in one frame
- e2e: `e2e/fixtures.ts` seeds the onboarding key so lobby and game specs keep starting at the lobby. A spec that calls `browser.newContext()` must call `skipOnboarding` on it; only `onboarding.spec.ts` uses the bare Playwright `test`

## Theme mechanism

- The app theme is stored as `theme` in `tic-tac-toe:preferences`; `public/theme-init.js` applies it to `<html data-theme>` before the app paints, and `src/hooks/useAppTheme.ts` updates it from Settings. `src/index.css` uses that attribute for dark tokens and Tailwind `dark:` variants. Keep inherited text color on `html/body/#root` there; any element without its own `text-*` utility inherits the selected foreground
- Surfaces that carry a form are denser in light than the HUD glass: `.lobby-screen-glass` reads `--glass-surface-alpha` (0.62) and `.sheet-surface` reads `--glass-sheet-alpha` (0.78) because a sheet sits over live lobby content that otherwise shows through as blue and red blobs. Dark keeps 0.28. The light scrim is a cool slate (`--color-overlay-scrim`), not black, which turned the page and sheet muddy. Start Game's tint is `--cta-alpha` through `ctaStyle` (0.38 light, 0.15 dark), the one place all three Start buttons read it. The refraction slivers on `glass-interactive` borders use `--glass-refract-alpha` (0.16 light, 0.5 dark): at 0.5 they were stray black dashes on a light card
- `color-scheme: light` on `:root` and `color-scheme: dark` on `:root[data-theme="dark"]` keep browser-drawn controls and scrollbars aligned with the selected palette

## Mobile layout mechanics

- The app shell stretches its child below `sm` and centers at `sm:`. Auto cross-axis margins suppress the stretch, so the lobby wrapper leaves `my-auto` off (its card stretches to fill a phone) while the game wrapper keeps it (the board stays vertically centred instead of hanging off the top of a tall phone with 300px of dead space below)
- The lobby form is `my-auto max-h-full` against that stretched shell: short content centres at its natural size, tall content (Online adds a match-type row and a room-code field) fills the phone and scrolls its middle while the footer keeps Start pinned. Never let the card grow past `max-h-full` — that is what pushed the primary action below the fold
- Sheet drag-to-dismiss (`src/hooks/useDragToDismiss.ts`) is bound to the sheet's grabber/header, never the panel. Winning the gesture needs `touch-action: none`, and putting that on the panel would make its own pickers unscrollable; the handle carries `DRAG_HANDLE_TOUCH_ACTION` instead
- `useDismissOnOutsidePress` dismisses on `click`, not `pointerdown`. These panels expand inside a sheet, so collapsing one on pointerdown reflows the sheet and slides its close button ~35px before the pointer comes back up, swallowing the tap. Same reason the active check on `OnlineOption` is positioned out of flow: an inline check ate the label's width and truncated "Join" to "J…" at 320px

## Rendering Budget

- `BackgroundPattern` keeps the resting symbol grid on an offscreen base layer and repaints only the lit spotlight region per frame. `clearRect` the region before `drawImage`-ing the base back: a transparent source pixel composites as a no-op, so the copy alone leaves the previous frame baked in
- Canvas resolves gradient coordinates in the user space of the fill, not of `createRadialGradient`. The cached spotlight gradients (mouse and touch radius) are built at the origin and painted under `ctx.translate(aim.x, aim.y)`
- Pointer handlers record the position and start the rAF loop; they never draw. A synchronous draw per event repaints the grid twice per frame
- The reveal is a heat field, not a spotlight (`backgroundField.ts`, pure and canvas-free). Input stamps heat onto the symbols it reaches, time cools every hot symbol exponentially (`tau`: 200ms mouse, 340ms touch), so the fade is per symbol and the wake behind a hand is its real path, thinning out. The frame loop is `advance` (cool, open rings) then `stamp` (the held pointer) then `paint`, and it stops when `settled()` — no ring travelling and every hot symbol held by a stimulus. A parked cursor and an idle page cost nothing. Test the model directly; the canvas tests only pin what reaches the context
- A stamp covers the segment from last frame's aim to this frame's, so a flick lights its whole path. A jump over `MAX_SEGMENT` is an arrival, not a sweep: it is stamped as a point, or a tap across the screen would light a band nobody touched
- Touch is not a cursor. It rides `touchstart/move/end/cancel`, never pointer events: the browser cancels a touch pointer the moment it takes the gesture for a pan, so a dragging finger lit the field for one frame and then went dark. Mouse and pen ride pointer events and ignore `pointerType === "touch"`. The listeners are passive and capture so a control that stops propagation still leaves the field answering its taps
- Touch gets its own look (`TOUCH_REVEAL`): a smaller reach (240px is a phone's whole width), a longer wake, and a glow that leads the fingertip by 40px so it is not hidden under the hand. Every tap opens a ring (`TAP_RIPPLE`) that lights the symbols its front crosses and pushes them outward; a mouse click opens a smaller one. A `(hover: none) and (pointer: coarse)` device gets one soft welcome ring, because nothing else tells a touch visitor the field answers. Rings open on the next frame so they run on the frame clock, not an event timestamp
- Lit symbols are pushed off their resting spot, so the resting copy blitted back by the restore must be cleared (`FOOTPRINT`) or every lit symbol trails a twin. Clear before painting the tint and rings, not after: clearing last punches dark squares into them
- A lit frame is drawn in batches, one path and one stroke per (tone, heat level). Draw cost is the raster of stroked geometry, not call count: batching alone did not move the frame time, and `shadowBlur` was the worst of it. So there is no shadow: the hottest symbols (`HALO_HEAT`) get a second, wider, fainter stroke of the same path, and symbols below `DRAW_FLOOR` are not drawn. `visualHeat` remaps heat so a symbol at the floor draws exactly as it rests, which keeps the fade from popping where it stops
- Measure A/B, interleaved, against `origin/main`: absolute numbers move with machine load (one build read 6% and 14% an hour apart on a shared Mac). On a 4x throttled 1280x800 viewport with a continuous full-screen sweep, share of rAF gaps over 20ms: the original trail 12-17%, this reveal 12-14%, the same reveal drawn symbol by symbol with a long wake 75-82%. A touch drag on a 390px phone is 2-4%
- The board well (`glass-well`, tokens `--well-*` in `src/index.css`) is the only thing between the field and the nine cells, and the cells have no backdrop-filter, so the well's blur decides what the cells show. A flat `bg-white/50` let the reveal's coloured symbols read through empty cells in light mode and distracted from the marks. Do not drop the blur or lower `--well-alpha` to "show more field" there; the field belongs around the board. An in-page toggle at 4x throttle showed no measurable cost from the blur (that run used share-of-frames-over-20ms, which later proved noisy; see Symbols and Player Colors)
- Both layers above the canvas can hide the reveal. The dark scrim (`--bg-mask-dark`) is an ellipse that covers nearly a whole phone, so phones use `--bg-mask-dark-phone`; the lobby's full-screen glass blurred the field to a haze in dark mode, so `.lobby-screen-glass` has no backdrop blur below `sm` in either theme
- Measure main-thread cost with `requestAnimationFrame` frame gaps. Headless Chromium's `longtask` `PerformanceObserver` reports nothing, even for a deliberate 120ms block, so a clean long-task reading is an unproven instrument

## Symbols and player colours (implementation)

- Every symbol is drawn once, in `src/game/shapeGeometry.ts`: centerlines on a 100-unit grid using only M, L, C, A and Z. `SymbolShapeRenderer` strokes it as SVG; `BackgroundPattern` compiles the same commands into a flat op list and traces them. Never hand-trace a shape in the canvas again: the old duplicate had a different heart and a different triangle, and the SVG heart was 99 units wide in a 100-unit box. `shapeGeometry.test.ts` pins the invariants (ink inside the box, centred, longest side 54-76 units, X heavier than outlines because its strokes cross)
- Arcs are real arcs (`A`), not Bézier approximations: SVG draws them exactly and the canvas calls `ctx.arc`. Four-curve circles ran 40% slower there. A full circle compiles to one op that moves to `(cx+r, cy)` and arcs from angle 0 so the rasteriser keeps its circle fast path; tilting it, or leaving the rotated `moveTo` in front, loses it
- `field` is an optional cheaper outline for symbols a few pixels across (square without corner radii, heart as two fitted cubics). A test keeps it within 2 units of the board's shape and caps curved segments at 3. Add one only for a shape whose detail is invisible at 6px and measured expensive
- A retired symbol still has to load: `LEGACY_SHAPES` maps a saved `hexagon` on read (`preferences.ts`) and `migrateLegacyShapes` maps one relayed by an older cached client at the room ingress, so neither drops a game. The reverse cannot be fixed from here — an old client receiving `crescent` rejects the frame. [DESIGN.md](DESIGN.md) owns why the set changed
- Player colours live in `src/game/palette.ts` and as hex tokens in `src/index.css`: `--color-<name>-500` is the chip / identity colour and the mark in dark mode, `--color-mark-<name>` is the mark on the light well. `palette.test.ts` reads the stylesheet from disk and fails if the two drift. Read it with `node:fs`: Vitest resolves `?raw` on a stylesheet to an empty string, which turns every check into a silent pass. Before this, marks used Tailwind's default `-600` shades (the theme only overrode `-500`), `COLOR_RGB` held old v3 values and the canvas held a third copy, so yellow was hue 71 on the board (read as orange) and hue 95 on its own chip
- A pale yellow cannot reach 3:1 on a near-white tile without turning olive (the fill alone is 1.7:1), so on light it carries a thin darker casing (`--mark-casing-yellow`, drawn under the stroke by `SymbolShapeRenderer`'s `casing` prop; transparent in dark). Every other light mark is 2.9:1 or better. Tuning for contrast alone also pulled orange toward yellow, so the palette test also requires every pair to stay at least ΔE 11 apart (OKLab x100)
- `oppositeColor` never pairs neighbouring hues: orange faces blue, yellow faces purple (orange vs yellow was the nearest pair in the set). A test requires ΔE 25 in both themes
- An occupied cell uses `cell-tint` (a white tile plus the colour at `--cell-tint-alpha`, `--cell-rgb` set per cell). A flat `bg-<colour>/10` over the grey well mixed warm colours into khaki
- Measuring canvas cost: share-of-frames-over-20ms is a poor instrument. The same code read 5% and 14% in two runs an hour apart, and a build flipped from worse to better when only an unrelated file changed. Use frames per second over a fixed sweep, 10 or more interleaved rounds, and say how the ranges overlap. Main-thread busy time saturates (about 99%) at 4x throttle and cannot separate builds. Result for the shared geometry: about 3% lower fps than the hand-traced shapes (light 46.4 vs 48.2, dark 45.4 vs 46.7, ranges overlapping, same sign in all four comparisons); the crescent costing more than the hexagon it replaced accounts for part of it

## Record storage

- `useGameStats` stores one record per guest under `tic-tac-toe:stats:<guestId>`, the same identity key as the display name
- `GameStats.breakdown` keys results by `mode` (or `mode:difficulty` for vs Computer) so the record can be split per mode and AI difficulty. Records written before the field existed load with `breakdown: {}`
- `recordWin`/`recordLoss` require a `StatsContext`; passing the wrong mode or difficulty would misfile the result, so every caller passes the mode it actually played
