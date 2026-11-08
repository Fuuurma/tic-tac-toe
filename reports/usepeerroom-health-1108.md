# usePeerRoom — mechanical health refactor

**Landed:** `c9ea19e` on `origin/main` (fast-forward from `09c9d0b`), branch
`fleet/ttt-usepeerroom-1108`.

## Finding

The P3 mechanical-health row for this file (`WORK.md:276`, source
`research/mechanical/2026-10-26-repowise-tic-tac-toe.md`) read:

```
P3: health src/hooks/usePeerRoom.ts score=2.5 ccn=46 nest=2 dup=4.48% nloc=496
```

The scanner (`repowise health`, score < 4.0 = a refactor candidate) measures a
file's **worst function**: `max_ccn` is the highest cyclomatic complexity any
one function in the file carries, and `nloc` the file's non-blank lines.

`09c9d0b` had already pulled the protocol state machine out of this hook into
`src/lib/room-protocol/`, which took the file from ccn 52 to ccn 29 — still
above the scanner's own thresholds (a function is "complex" from ccn 9, and a
"large" one from 60 lines with a branch). The remaining complexity was not
the protocol: it was the **decisions** the hook made, all inlined into the
hook body.

## Fix

Every decision is now a plain function over an explicit dependency bag, next
to the hook that calls it:

| Handler | Decision it owns |
|---|---|
| `applyIncomingReaction`, `sendSocialReaction` | the reaction overlay and its cooldown |
| `applyLocalPause` (+ `freezeLocalClock`, `rebuildLocalClock`) | pause/resume and the turn clock |
| `applyHostPauseFrame` | the guest's view of a host pause |
| `commitRoleMove` | which side may move |
| `sendRematchRequest`, `applyRematchAccept`, `applyRematchDecline`, `applyRematchCancel`, `expireRematchRequest` | the rematch exchange |
| `handlePeerRoomEvent` | relay events |
| `leavePeerRoom` | leaving |
| `syncTurnTimer` | the turn countdown |

`canRequestRematch` and `shouldRunTurnTimer` now take a named gate instead of
five positional arguments — two of which were booleans that could be swapped.

Behaviour is unchanged: the hook's public API, the wire messages, the
host/guest clock asymmetry (F226 — a guest never rebuilds its deadline on
resume) and the identity of every returned callback are the same.

## Measured

Same scanner, same ruleset, one commit either side:

| | score | max_ccn | max_nesting | dup % | nloc |
|---|---|---|---|---|---|
| before (`09c9d0b`) | 3.14 | 29 | 2 | 4.70 | 625 |
| after (`9297842`) | **9.0** | **6** | 2 | 4.73 | 858 |

`src/hooks/usePeerRoom.ts` no longer appears in the scanner's `score < 4.0`
list. `nloc` grew because the rules now carry their own doc comments and
dependency interfaces; duplication did not move.

## Gates

- `pnpm test` — 903 tests / 78 files, green (50 in the two `usePeerRoom`
  suites, 33 of them new)
- `pnpm lint` — clean · `tsc -b` — clean
- `pnpm test:e2e` — 39 passed, 2 failed. Both failures are **baseline-red**:
  `quick-match.spec.ts` fails identically on a pristine `origin/main` export
  (the reactions sheet intercepts the click on the "👋 Hello!" button — a
  layering bug in the surface, not in this hook), and
  `smoke.spec.ts` "two online sessions sync" passes on this branch when run
  on its own; it only failed in the full run as collateral of the
  quick-match failure leaving a stale session on the Worker.

## Not covered

The `duplication_pct` of the file is unchanged, so no consolidation work is
owed here. The other P3 health rows in this repo
(`onlineGameSurface.tsx` ccn 93, `playersPanel.tsx` ccn 81, `lobbyForm.tsx`
ccn 57, `backgroundPattern.tsx` ccn 71, `peer.wire.ts` ccn 64) are separate
slices.
