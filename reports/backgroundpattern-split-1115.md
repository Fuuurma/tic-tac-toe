# BackgroundPattern split — react-doctor verification (TTT-RD-BGPattern)

**Verdict:** DONE — `src/components/backgroundPattern.tsx` split so the
`no-giant-component` row clears. Verified on the lane branch, landed on
`origin/main` as `ba57a4c`.

## Finding cleared

WORK.md row "tic-tac-toe: split BackgroundPattern for react-doctor
giant-component": `react-doctor/no-giant-component` on
`src/components/backgroundPattern.tsx:355` — the `BackgroundPattern`
function body was 486 lines, almost all one `useEffect`.

## What changed

Same public interface (`BackgroundPattern` unchanged; `App.tsx` and the
test suite import it exactly as before). The component is now a canvas
shell (`useRef` + `useEffect` + the same `<canvas>` element) over two pure
sibling modules, matching the `backgroundField.ts` "module used by one
component stays beside it" exception:

- `src/components/backgroundPatternDraw.ts` — the drawing primitives:
  `SYMBOL_SIZE`/`SYMBOL_STROKE`, the ink constants, `LEVELS`, `DRAW_FLOOR`,
  `HALO_HEAT`, `COLOR_HEX`, `LitStyle`, `buildLitStyles`, `visualHeat`,
  `inkStyle`, `inkForTheme`, and the whole Drawing section (hand-rolled
  rotation helpers, `OP_*` codes, `GRID_PER_SIZE`, `COMPILED_SHAPES`,
  `traceShape`).
- `src/components/backgroundPatternEngine.ts` — `mountBackgroundPattern(canvas)`
  returns the effect's cleanup (or `undefined` on the same bail-outs):
  reveal/ripple constants, `unionOf`/`padded`, and the entire former effect
  body verbatim — base-layer build, `paint`/`litBounds`/`restoreBase`,
  `resize`, the `step` rAF loop, `aimAt`/`release`/`ripple`, every
  pointer/touch/visibility handler, the theme `MutationObserver`, the
  welcome ripple and the full listener teardown.

Every moved line is verbatim: a scripted check replayed each new file's
code lines against `git show HEAD:src/components/backgroundPattern.tsx`
and found zero altered lines — only added `export` keywords, the two new
import blocks, the `mountBackgroundPattern` signature and a uniform
two-space dedent of the former effect body. Touch-reveal behaviour, the
rAF cadence, listener options and cleanup order are untouched.

`ARCHITECTURE.md`'s module line now names all three BackgroundPattern
modules instead of calling `backgroundField.ts` the only one.

## Verification

- `npx react-doctor@0.9.14 --json --scope files
  src/components/backgroundPattern.tsx`: **0 diagnostics** (baseline: the
  one `no-giant-component` warning at :355).
- `pnpm lint` — clean.
- `pnpm test` — 907 tests / 78 files, green; the 41
  `backgroundPattern`/`backgroundField` cases (resize coalescing,
  reduced-motion gating, pointer repaint, wake, touch, remount init) pass
  unchanged against the public component.
- `pnpm build` (`tsc -b && vite build`) — exit 0.

`pnpm test:e2e` was not run: it needs the matchmaking Worker on
127.0.0.1:8787 and this change touches no online-play code path; the
canvas element, classes and effect wiring are byte-identical.
