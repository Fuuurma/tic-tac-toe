# TTT-DEP-BUMP follow-up — remaining dev-advisory chains

Date: 2026-11-12 · lane: fleet/ttt-dev-advisories · base: origin/main @8e5b841
Source audit: software-factory `stream/mechanical/2026-11-12-dep-audit-tic-tac-toe-worker.md`
(row WORK.md:451; file lists the 10 advisories left after TTT-DEP-BUMP — the
row title's "27" is the pre-bump total). Spec: direct bumps only where parent
ranges allow; lockfile regen; no blanket overrides (F2170).

## What changed (pnpm-lock.yaml only)

| chain | before | after | clears |
|---|---|---|---|
| jsdom → undici | 8.11.2 | 8.12.4 | 8 advisories (4 high + 4 moderate) |
| eslint-plugin-react-hooks → zod (+ zod-validation-error peer) | 4.4.3 | 4.6.7 | 1 high |

Both are in-range re-resolutions, not parent bumps: jsdom@30.1.1 declares
`undici ^8.10.2` and eslint-plugin-react-hooks@7.1.1 (already latest) declares
`zod ^3.25.0 || ^4.0.0`, so `pnpm update undici zod` moved the lockfile to the
patched releases without touching package.json. undici 8.12.4 (2026-11-05) and
zod 4.6.7 (2026-10-12) both clear `minimumReleaseAge: 1440`.

## Audit result

`pnpm audit`: **10 → 1** vulnerability (5 high + 5 moderate → 1 moderate).
`pnpm audit --prod`: clean, as before. No new advisories.

Remaining 1, unfixable within parent ranges:

- eslint → minimatch 10.2.5 (<11.0.1): 1 moderate — every parent in the chain
  caps at `^10.x` (eslint@10.14.0 wants `^10.2.6`, @eslint/config-array@0.23.5
  `^10.2.4`, @typescript-eslint/typescript-estree@8.72.2 `^10.2.2`). Reaching
  >=11.0.1 needs an override forcing a new major onto eslint's glob engine —
  out of spec ("direct bumps only where parent ranges allow; no blanket
  overrides").

## Gates

- `pnpm lint` — green
- `pnpm test` — 904 tests / 78 files, green (vitest 4.1.12, vite 8.3.8)
- `pnpm build` — green (tsc -b && vite build)
- `pnpm test:e2e` — not run: no online-play change; needs the matchmaking
  Worker on 127.0.0.1:8787.

## Landed

- lockfile regen: see git log for the chore commit on fleet/ttt-dev-advisories
