# TTT-FLAGGED-TRIAGE — verdicts on the 6 BRANCH-SWEEP-468 flags (2026-11-17)

Read-only triage of the six branches `control/fleet/BRANCH-SWEEP-468.md`
flagged for coordinator review. Nothing was landed, rebased, pushed or
deleted. Base: `origin/main@e08bd1c` (fetched 2026-11-17 ~12:4xZ; the sweep
snapshot base was `e2ac570` and main has since gained `200243c`, `9dbf98b`,
`e08bd1c` and others). All six refs still exist on the remote at their
sweep-recorded tips (`git ls-remote` verified).

Method per branch: `git rev-list --left-right --count origin/main...<ref>`
(main-ahead / branch-ahead), `git merge-tree --write-tree` plus a
scratch-worktree trial `git merge --no-commit` at `origin/main` for the
conflict list, per-file diff inspection, and symbol/supersession checks
against current main.

## Verdicts

| branch | tip | ahead/behind vs main | verdict |
|---|---|---|---|
| `Fuuurma/ttt-promo-video1` | `0846414` | +4 / −23 | **STALE-DELETE-CANDIDATE** — promo shipped on main as `f32ba2a` with rendered outputs; the branch is a superseded WIP snapshot |
| `archive/ttt-f346-remainder` | `a512842` | +4 / −184 | **KEEP-FLAGGED** — pause fix superseded, but 3 component extractions + 2 e2e specs are unique and conflict on files main evolved 184 commits |
| `archive/fleet/ttt-roomlifecycle-health` | `fe2522d` | +1 / −59 | **FIX-THEN-LAND** — the duplication it removes is still verbatim on main; one-file conflict, bounded re-apply |
| `archive/archive/convex-better-auth-migration-2026-07-09` | `b554069` | +18 / −559 | **KEEP-FLAGGED** — parked auth/Convex migration on the retired Next.js stack; the risk-class review is still owed |
| `archive/convex-better-auth-migration-2026-07-09` | `b554069` | +18 / −559 | **KEEP-FLAGGED** — literal duplicate ref of the above (same SHA); at most one ref is needed |
| `archive/codex/games-standard-stack-migration` | `012cd63` | +17 / −559 | **STALE-DELETE-CANDIDATE** — strict ancestor of the convex ref (0 unique commits); same retired stack |

## Evidence per branch

### `Fuuurma/ttt-promo-video1` @ `0846414` — STALE-DELETE-CANDIDATE

- The promo work shipped on main the same day: `f32ba2a`
  "feat(promo): launch promo video, vertical and square cuts
  (TTT-PROMO-VIDEO1)", authored 2026-11-16 19:26 — 21 minutes after the
  branch tip `0846414` (19:05). `git merge-base --is-ancestor` says the
  remote tip is NOT an ancestor of `f32ba2a` (the landing was curated onto
  a different base, `f75af60`), but the local branch of the same name
  already points at `f32ba2a` — the remote ref is the abandoned WIP line.
  `reports/promo-video-1116.md` documents the shipped 20.7 s vertical +
  square cuts under `promo/out/`.
- Branch diff vs merge-base `12d87d2` (2026-11-16): 27 files, +4177, **all
  under `promo/`** — zero non-promo paths.
- Main's `promo/` is a strict superset in kind: it adds the rendered
  outputs (`promo/out/*.mp4`, 6 stills) the branch lacks, and its sources
  are the refined versions — staggered caption entrances in
  `Caption.tsx`, join-aware `ONLINE_FOCUS` in `timeline.ts`, the fingertip
  ring and camera-pan description in `PhoneClip.tsx`/`README.md`. Every
  differing hunk reads as main-ahead, not branch-ahead.
- Trial merge at `origin/main`: 12 unmerged files, all add/add conflicts
  inside `promo/` (gitignore, README, captures json+mp4, stills.mjs,
  Promo.tsx, Caption, PhoneClip, layout, timeline) — main's side is newer.
- Sibling note: `archive/Fuuurma/ttt-promo-video1` @ `e12466d` is an
  ancestor of this tip (verified) — it is a fortiori also stale.

### `archive/ttt-f346-remainder` @ `a512842` — KEEP-FLAGGED

- Flag still valid. +4 / −184 vs merge-base `52e1a03` (2026-10-15).
- Commit `eee2c12` ("keep confirmation pause across rerenders") is
  superseded: main's `playersPanel.test.tsx:323` carries "holds the
  exit-confirmation pause when the parent passes a new callback identity"
  and `playersPanel.tsx` has the `confirmPauseRef`/`useConfirmReset`
  machinery — the same fix in evolved form.
- The remaining three commits are unique work absent from main:
  `lobbyFormLayout.tsx`, `onlineConnectionBanners.tsx`,
  `playersPanelHeader.tsx` do not exist on main (`git ls-tree`), and main's
  `lobbyForm.tsx`/`onlineGameSurface.tsx`/`playersPanel.tsx` remain
  monolithic at 1012/1125/1033 lines. The two `e2e/f346-*.spec.ts` files +
  snapshots exist only on the branch.
- Trial merge: 4 content conflicts — `lobbyForm.tsx`,
  `onlineGameSurface.tsx`, `playersPanel.tsx`, `playersPanel.test.tsx`.
- Reasoning: landing this means re-doing three extractions on files that
  evolved 184 commits — a fresh refactor slice, not conflict resolution.
  Whether the monolith split is still wanted is a coordinator/product
  call, so the flag stays.

### `archive/fleet/ttt-roomlifecycle-health` @ `fe2522d` — FIX-THEN-LAND

- Flag still valid, and the need is verified live. +1 / −59 vs merge-base
  `19c74a9` (2026-10-28).
- The commit's premise still holds on main: `roomLifecycle.ts` (371 lines)
  carries the same hand-written room-scoped reset list twice — in
  `startHostAttempt` (host path) and `joinAsGuest` (guest path) — and still
  builds the guest `join` frame inline at two sites (welcome ~L126,
  WAITING resend ~L147). Neither `resetRoomEntryState` nor `sendGuestJoin`
  exists on main.
- What changed since: main wrapped host entry in `startHostAttempt` with
  friend-room-code collision retry (`FRIEND_ROOM_CODE_ATTEMPTS = 3`,
  `isRoomCodeConflict`, `generateFriendRoomCode`, `canonicalRoomId` —
  TTT-UX-FIX2 F1, landed after the merge-base). The branch predates it.
- Trial merge: exactly 1 unmerged file, `roomLifecycle.ts`; the parity test
  in `roomLifecycle.test.ts` auto-merges cleanly.
- Fix scope: re-apply the two helpers onto the current file — the reset
  call moves into `startHostAttempt`/`joinAsGuest`, the join send into the
  two message-handler sites. Mechanical, and the branch's parity test pins
  the cleared set.

### `archive/archive/convex-better-auth-migration-2026-07-09` and
`archive/convex-better-auth-migration-2026-07-09` @ `b554069` — KEEP-FLAGGED

- Both refs resolve to the same commit `b554069` — literal duplicate refs
  (the `archive/archive/` path is a naming accident). Same verdict for both.
- The tip commit says it plainly: "archive: park Convex + Better Auth
  migration attempt … parked while the first public slice ships as
  guest-only Next.js + Socket.IO."
- Scope vs merge-base `eda4759` (2026-07-02): 148 files, +13219/−469 —
  Convex backend functions, better-auth routes/config, login form, account
  status, plus vendored `.agents`/`.claude` convex skills. +18 / −559.
- Retired stack verified gone from main: no `app/` tree, no
  `next.config.ts`, `package.json` is React 19 + Vite 8 + Tailwind with
  zero convex/better-auth entries, and no convex/better-auth reference
  anywhere in `src/` or `e2e/`. Current product is guest-only
  (`AGENTS.md`: "Auth: None (guest-only)").
- Trial merge: 34 unmerged files across the dead tree (app/, components/,
  tests/, configs, lockfile).
- The flag's risk class (auth/credentials migration) is unchanged — this
  is exactly the coordinator hard review the sweep reserved. If the work
  is kept for reference, one ref suffices; if dropped, both go together.

### `archive/codex/games-standard-stack-migration` @ `012cd63` — STALE-DELETE-CANDIDATE

- +17 / −559 vs the same merge-base `eda4759`; same retired Next.js +
  Convex stack as the auth branch (its commit list is the same migration
  minus the park commit).
- Strict ancestor: `b554069`'s parent IS `012cd63`; `git rev-list` shows 0
  commits on this ref that the convex ref lacks, and exactly 1 the other
  way (`b554069` itself). The ref carries zero unique history.
- Trial merge: 30 unmerged files, all inside the retired tree.
- Deleting it loses nothing while
  `archive/convex-better-auth-migration-2026-07-09` is kept; if the parked
  migration is dropped entirely, this ref goes with it.

## Summary for the coordinator

- **Land nothing from this set as-is.** No branch merges cleanly; the only
  near-term actionable item is `ttt-roomlifecycle-health` (FIX-THEN-LAND,
  one file, verified-live dedup).
- **Two refs are pure redundancy:** the twin convex refs share SHA
  `b554069`; `games-standard-stack-migration` is a strict ancestor of them.
- **One flag went stale:** the promo branch — its work shipped as `f32ba2a`
  before the sweep snapshot was even taken.
- **Three flags remain live and need judgment, not lanes:** the f346
  extractions (re-implement on current main or drop) and the parked
  auth/Convex migration (keep-for-reference vs delete — the risk-class
  call the sweep reserved).
