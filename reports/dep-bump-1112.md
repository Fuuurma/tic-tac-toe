# TTT-DEP-BUMP — dev-advisory chain bumps

Date: 2026-11-12 · lane: fleet/ttt-dep-bump1-1112 · base: origin/main @2981e99
Source audit: software-factory `stream/mechanical/2026-11-12-dep-audit-tic-tac-toe-worker.md`
(27 dev-only advisories, 0 ship-reachable). Spec: bump direct deps only, no
`pnpm.overrides` (F2170).

## What changed (package.json + pnpm-lock.yaml)

| direct dep | before | after | clears |
|---|---|---|---|
| vite | 8.3.2 → 8.3.8 | ^8.3.8 | vite <=8.3.2 advisories (1 high + 1 low + 4 moderate) |
| vitest | ^4.1.11 → 4.1.12 | ^4.1.12 | @vitest/mocker 4.1.12 (2 moderate) |
| wrangler | ^4.147.0 → 4.160.1 | ^4.160.1 | undici 7.30.1 via miniflare (8 advisories) |
| tailwindcss / @tailwindcss/vite | ^4.3.3 → 4.3.5 | ^4.3.5 | source-map-js 1.2.2 (1 high) |

Notes:

- wrangler 4.161.0 exists but was <24h old; `minimumReleaseAge: 1440` in
  pnpm-workspace.yaml held resolution at 4.160.1, whose miniflare already
  pins undici 7.30.1.
- vitest stayed on 4.x (4.1.12 is the newest 4.x); 5.1.0 exists but is a
  major bump outside the spec.
- `pnpm dedupe` could not run (it re-resolves the github: Fuuurma/
  fuurma-matchmaking pin and fails without repo credentials); `pnpm up
  source-map-js` updated the transitive dep in place instead — css-tree
  (via jsdom) and postcss now resolve 1.2.2 like @tailwindcss/node.

## Audit result

`pnpm audit`: **27 → 10** vulnerabilities (11 high + 15 moderate + 1 low →
5 high + 5 moderate). `pnpm audit --prod`: clean, as before.

Remaining 10, all out of the spec's named chains:

- jsdom → undici 8.11.2 (<8.12.2): 4 high + 4 moderate — jsdom is pinned
  `30.1.1`; a jsdom bump is a test-infra change, not in this slice.
- eslint-plugin-react-hooks → zod <4.6.6: 1 high.
- eslint → minimatch <11.0.1: 1 moderate.

## Gates

- `pnpm lint` — green
- `pnpm test` — 903 tests / 78 files, green (vitest 4.1.12, vite 8.3.8)
- `pnpm build` — green (tsc -b && vite build)
- `pnpm test:e2e` — not run: no online-play change; needs the matchmaking
  Worker on 127.0.0.1:8787.

## Landed

- dep bump: `363cfdf` on origin/main (fleet/ttt-dep-bump1-1112)
- this report: see git log for the docs commit on the same branch
