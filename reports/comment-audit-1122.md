# Comment audit bootstrap — tic-tac-toe

Date: 2026-11-22 · lane: sf/t_01M7WXFYCK77X6A4PFX5F92CE5/e19 · base: origin/main @74937fe
Task: t_01M7WXFYCK77X6A4PFX5F92CE5 "Bootstrap comment audit and ratchet"

## Inventory (measured, not estimated)

Every tracked code file was scanned with the ratchet's own lexer
(`collectComments` in `scripts/check-comments.mjs`: TypeScript scanner for
ts/tsx/js/jsx/mjs/cjs/mts/cts, `@csstools/css-tokenizer` for css). Comment
*blocks* and the physical lines they span:

| Scope | Comment blocks | Comment lines | Files |
|---|---:|---:|---:|
| src/lib | 1,108 | 1,665 | — |
| src/components | 932 | 1,319 | — |
| src/hooks | 466 | 719 | — |
| src/game | 253 | 435 | — |
| src/other (index.css, App.tsx, i18n, __tests__, misc) | 130 | 352 | — |
| e2e | 206 | 235 | 9 |
| scripts | 47 | 69 | 4 |
| public | 1 | 1 | 1 |
| root configs (vite/vitest/playwright/eslint/vitest.setup) | 21 | 27 | 5 |
| **Total** | **3,164** | **~4,822** | **176** |

Tracked source/tests/scripts total ~54.8k lines, so **~8.8% of the repo is
comments**. Of the blocks: 400 are `/** */` API docs (1,866 lines), 51 are
tooling directives (`eslint-disable`, `@ts-*`, `@vitest-environment`,
`/// <reference>`, `__PRECACHE_MANIFEST__`, `/* global */`), and ~2,713 are
`//` line comments plus non-JSDoc block comments — the audit surface.

Out of scope by construction: `index.html`, `diagrams/architecture.html`,
`wrangler.jsonc`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml` (no
scannable comment syntax wired in), vendored `.agents/`/`.devin/` skill
files (pinned by skills-lock, not project source), and Markdown docs.

## Classification

Heuristic first pass over all 3,164 blocks (directive → JSDoc → excuse →
stale → decision-marker → review), then **every comment in the periphery
slice read in code context**: e2e/ (all 9 files), scripts/, root configs,
public/theme-init.js, src/i18n/, src/__tests__/, src/main.tsx,
src/vite-env.d.ts — ~350 blocks verified by hand. Large src/ areas got
identifier-existence and stale-marker sweeps plus spot reads; the
per-area deep pass is staged as follow-up tasks below.

| Class | Count (heuristic) | Disposition |
|---|---:|---|
| required directive / API doc | ~451 | Retained — tooling markers and the repo's module-doc convention |
| decision record (rationale, F-numbers, regression pins, measured dates) | ~789 | Retained in place — they are the repo's documented legibility mechanism; system-level ones already live in ARCHITECTURE.md |
| excuse (rationalized workaround) | 7 candidates → **0 confirmed** | All are deliberate-fallback documentation (best-effort storage, "not yet expired" queue semantics, "harmless" one-frame lag). No repair tasks filed — nothing to repair |
| stale (describes gone behavior) | 37 candidates → **0 confirmed** | All are regression narratives ("used to …") or live-state descriptions. Identifier sweep found zero references to missing symbols |
| tautology (code already states the fact) | **5 removed** | See slice below; remainder needs per-file eyes in follow-ups |
| unclassified (`//` narration without strong markers) | ~1,877 | Pending per-area review — expected mix of keep-worthy step intent and a thin tautology tail |

**No durable decision found in the audited slice was missing from
ARCHITECTURE.md**, so nothing was moved. ARCHITECTURE.md is the repo's
decision location ("mechanism … and the traps"); DESIGN.md owns visual
rationale. `docs/adr/` does not exist and the domain-modeling ADR bar
(hard-to-reverse + surprising + real trade-off at system level) was not
met by any comment reviewed — local rationale stays colocated.

## First slice (this change)

Removed 5 tautological step-narration comments in `e2e/` — each restated
the adjacent Playwright calls with no added fact:

- `e2e/quick-match.spec.ts` — "// Host starts a quick match.",
  "// Guest starts a quick match", "// Host plays top-left"
- `e2e/smoke.spec.ts` — "// Fill the player name inside the settings
  sheet.", "// Host creates a private room."

Kept: every comment carrying intent the code does not state (assertion
purpose, precondition, regression story, mechanism, constraint) — e.g.
the "// Both reach the board and connect" then-clause, the `// X`/`// O`
move labels, and all why-comments.

## Ratchet

`node scripts/check-comments.mjs` (in `pnpm lint`) previously froze
`scripts/comment-baseline.json` at 2,933 blocks over `src/` + `scripts/`
only. This change widens it to **every tracked source, test and script
tree**: `SOURCE_DIRS` gains `e2e` and `public`; `SOURCE_FILES` pins the
five root configs; `SCANNABLE_EXTENSIONS` gains `.mts`/`.cts` (covers
`scripts/check-comments.d.mts`). New `inventoryFiles()` export; the
vitest real-tree pin now merges dirs + files and asserts e2e/scripts/root
coverage. Baseline re-frozen at the measured state: **3,164 blocks / 176
files** — deletions-only from here, same as before.

## LOC savings

- Current comment-only lines: **~4,822** (8.8% of 54.8k tracked LOC).
- This slice: **−5 lines** (−0.1% of comment lines).
- Projected: honest range is low — the corpus is rationale-dense by
  design. If follow-up slices hold the same bar (delete only what the
  code already states), expect **~3–8% of comment lines** (~150–400
  lines) recoverable, concentrated in `//` step narration inside the
  1,877-block `review` bucket. JSDoc (1,866 lines) and directives are
  retain-class and will not move.

## Follow-up tasks (independent; all verify `pnpm lint && pnpm test &&
pnpm build`, each blocked by this task's merge)

1. **src/lib comment audit** — 1,108 blocks / 1,666 lines. Split
   room-protocol/ (state machine, ~700 blocks est.) from the rest
   (peer.wire, identity, storage, matchmaking) if one slice is too big.
   Verify: `pnpm lint && pnpm test && pnpm build`; after removals run
   `node scripts/check-comments.mjs --update-baseline`.
2. **src/components comment audit** — 932 blocks / 1,319 lines. Includes
   the backgroundPattern* canvas modules and board/lobby surfaces.
   Same verify + baseline step.
3. **src/hooks comment audit** — 466 blocks / 719 lines (usePeerRoom is
   the single densest file at 262 comment-lines).
4. **src/game + src/other comment audit** — 383 blocks / 787 lines
   (pure domain + index.css + App.tsx + i18n + __tests__). CSS section
   comments deserve the same tautology test.
5. **e2e second pass (optional)** — the slice above cleared strict
   tautologies; a lighter pass may trim remaining step narration, but
   most e2e comments are assertion-intent and likely retain-class.

Each follow-up owns only its area; none may touch another area's files.
No blocking edges between them — they can run in any order or parallel
on separate branches (baseline JSON conflicts resolve by regenerating:
`node scripts/check-comments.mjs --update-baseline`).

## Repair tasks for excuses

None filed: zero confirmed excuse-class comments in the audited scope.

## Gates

- `pnpm lint` — green (eslint + `check-comments.mjs` at new baseline)
- `pnpm test` — see commit; comment-ratchet suite extended, not weakened
- `pnpm build` — green
- `pnpm test:e2e` — not run: comment-only deletions in spec files; the
  matchmaking Worker on 127.0.0.1:8787 was not exercised. The deleted
  lines were comments; specs are unchanged semantically.
