# Pin board-cell VANISH_MS to the CSS vanish keyframe duration (2026-11-17)

## Slice

`test(ttt): pin board-cell VANISH_MS to CSS vanish keyframe duration`.
Base: `origin/main@e2ac570`. Worktree: `ttt-vanish-duration`.

## What shipped

Added `src/__tests__/vanishDuration.test.ts`, a repo-level source pin in the
style of `src/__tests__/agentsStructure.test.ts`. It reads two independent
sources from disk:

- the duration in `animation: vanish 0.55s …` inside `@utility animate-vanish`
  in `src/index.css`, converted from seconds to milliseconds;
- `const VANISH_MS = 550;` in `src/components/game/boardCell.tsx`.

The single assertion compares the two numbers. Both parsers assert their own
match first, so the test cannot pass on two `undefined`s.

No production edit: the two values already agree at 550 ms. The comment in
`boardCell.tsx` records an earlier drift (600 ms constant against a 550 ms
keyframe); this pin is what that comment lacked.

## Why a source pin, not a behaviour test

Neither value is reachable through the public UI — one is a CSS animation
duration, the other a `setTimeout` teardown in a hook. Lint, tsc and the 991
existing tests all stay green on a drift between them, so only a test that
reads both files directly can catch it.

## Verification (evidence, not intent)

Baseline: the new test is green alongside the full suite — `pnpm test`
**992 passed / 87 files** (991 before the slice + 1 new test).

Mutation proof, each run on the isolated test file and then reverted with
`git checkout --`:

| Mutation | Result |
|---|---|
| `src/index.css`: `vanish 0.55s` -> `vanish 0.6s` | `expected 550 to be 600` — FAIL |
| `boardCell.tsx`: `VANISH_MS = 550` -> `600` | `expected 600 to be 550` — FAIL |
| both restored | PASS |

So the test fails when either side changes alone.

Other gates: `pnpm lint` clean; `pnpm build` clean (`tsc -b && vite build`,
3741 modules transformed).

Note: `vitest.config.ts` still uses `__dirname` and emits a configLoader
warning — baseline, out of scope for this test-only slice. (Fixed the same
day: `vitest.config.ts` now uses `import.meta.dirname`, so the warning is
gone. See `reports/vitest-config-dirname-1117.md`.)

## State

Committed as `83ca130` on `fleet/ttt-vanish-duration`, pushed to origin.
`origin/main` was still `e2ac570` (the merge base) and the branch fast-forwards
cleanly, but `sf_git_push_land` refused promotion: the branch is under the
standard per-lane assignment/review hold. Landing onto `origin/main` awaits
coordinator review and hold release.
