# TTT-AI-TIMING-RED1 — red-main AI timing failures

Fix commit: `119eee0` on `main` (parent `8c583e3`).

## The 3 failing tests

Named from `reports/pwa-phase0-1116.md` ("ai.bench.test.ts ×2,
game.property.test.ts ×1") and reproduced red-first on this machine with
`npx vitest run src/game/ai.bench.test.ts src/game/game.property.test.ts
--testTimeout=400` — all three fail `Error: Test timed out`:

1. `src/game/ai.bench.test.ts > AI move cost > Easy always stays well under
   the mobile budget` (then-named suite; each bench test ran the full
   `benchmark()` — 72 timed `getAIMove` calls, ~0.5–3s wall depending on
   host load — against vitest's default 5s `testTimeout`).
2. `src/game/ai.bench.test.ts > … > keeps search bounded and reports
   mobile-budget breaches` — same timeout exposure, plus a latent
   `floorMs < 500` assertion (HARD depth-8 floor measured 228–418ms under
   load; the file's own comment records a healthy 300→520ms excursion on a
   shared CI node).
3. `src/game/game.property.test.ts > game-rule properties > the AI never
   emits an occupied or illegal cell on any generated state` — `fc.assert`
   (100 runs) invoking real EASY/NORMAL/HARD searches with no explicit
   timeout, so the 5s default applied.

## Cause — hypothesis (b), with evidence

The tests asserted wall-clock on a loaded host; the AI did not get slower.

- `src/game/ai.ts` is unchanged since `ff0b2dd` (2026-09-17), ~2 months
  before the failures; the only recent `src/game` change (`44b5957`, F135)
  is a ternary inside `makeMove`, not the search.
- Failures were "identical on the pristine base" (`7444e77`) per the PWA1
  report — baseline-red, not a regression.
- Node counts are identical across runs and machines (NORMAL: 767/148/19/
  570; HARD: 4854/986/42/4936 across the four bench states; EASY: 0) —
  search cost is a property of the code, wall-time is a property of the
  host.
- This fleet Mac (10 cores / 16 GB) routinely runs at load avg 15–40 from
  sibling agents; vitest `maxWorkers: 3` still loses CPU slices for seconds
  at a time.

## Fix

- `src/game/ai.ts`: optional `AiSearchStats` out-param on `getAIMove`
  counts minimax nodes visited (0 for EASY / inactive / no children).
  Signature is backward compatible; `useLocalGame` and all existing callers
  are untouched.
- `src/game/ai.bench.test.ts`: rewritten to gate on node ceilings
  (EASY 0, NORMAL 1600, HARD 10000 — ~2× the observed maxima) over 12
  single calls (~0.1–0.3s) instead of 72 timed samples; ms stays as a
  warn-only mobile-budget diagnostic; the `makeMove` frame-budget check
  moved from max-of-18 to floor-of-many (same statistic b82070b chose for
  the search ceiling).
- `src/game/game.property.test.ts`: the two AI-invoking properties get the
  selfplay suite's explicit `30_000` hang-guard instead of the 5s default.

## Run-to-run timing, before → after

- `ai.bench.test.ts` file: ~0.6–3s per run under fleet load → ~0.2s
  (88ms + 76ms for the two cost tests, measured post-change).
- Whole `pnpm test`: 31.8s idle / 111s under 24 CPU burners (all green
  both ways on this tree) — post-change suite still green at 47.8s under
  residual fleet load; the three formerly-red tests can no longer hit the
  timeout because their bodies are ~10× cheaper and their gates are
  deterministic.
- `pnpm lint`, `pnpm test` (921/921), `pnpm build` — all green.

## Mutation proof (test-value)

`MINIMAX_DEPTH_NORMAL` 4→5: bench goes red in 102ms with
`NORMAL move (first-move-empty-board) exceeded the node ceiling: expected
1854 to be less than or equal to 1600`. Reverted → green. The ceiling is
load-bearing, not decorative.

## Not done / notes

- Node ceilings bound search *size*; per-node constant-factor heuristic
  cost is still only visible via the warn-only ms report. Accepted: the
  named regression modes (ply, ordering, pruning) all move node count.
- `testEnv.test.ts` re-runs the whole suite under `NODE_ENV=production`;
  it failed transitively whenever the inner timing tests did and is green
  again now that they cannot time out.
