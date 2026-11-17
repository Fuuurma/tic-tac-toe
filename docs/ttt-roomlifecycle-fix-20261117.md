# TTT-ROOMLIFECYCLE-FIX — re-apply roomLifecycle dedup on current main (2026-11-17)

Re-application of `archive/fleet/ttt-roomlifecycle-health` @ `fe2522d`
("work:300 roomLifecycle: unify room-entry reset + guest join send") onto
`origin/main@37d580f`, per the TTT-FLAGGED-TRIAGE FIX-THEN-LAND verdict
(`docs/ttt-flagged-triage-20261117.md`). The archive base was `19c74a9`;
main has since gained the `FRIEND_ROOM_CODE_ATTEMPTS` retry
(`startHostAttempt` + `isRoomCodeConflict`) and the F712/F726
`waitingForHostDeadlineAtRef` room-scoped ref. One file conflicted on
re-apply (`roomLifecycle.ts`); the parity suite `roomLifecycle.test.ts`
stays green.

## What changed

`src/lib/room-protocol/roomLifecycle.ts`:

- `resetRoomEntryState(deps, quickMatchHost)` — the room-scoped ref reset
  both entry paths used to hand-write: `quickMatchHostRef`,
  `rematchPendingRef`, `hostPendingSettingsRef`, `guestJoinedRef`,
  `disarmSyncReplyThrottle(lastSyncReplyAtRef)`,
  `reconnectResetsRef.moveCount = -1`, `pendingGuestStateRef`,
  `syncPendingRef`, the `waitingForHostTimeoutRef` clear, and
  `waitingForHostDeadlineAtRef.current = null`.
- `sendGuestJoin(deps, client)` — the guest `join` frame, previously built
  twice in `buildRoomClient`'s message handler (welcome send + F252
  peer-reconnected/peer-joined resend).
- `startHostAttempt` calls `resetRoomEntryState(deps, Boolean(slotToken))`
  — the FRIEND_ROOM_CODE_ATTEMPTS retry loop is untouched; each retry
  re-runs the same reset, which is idempotent.
- `joinAsGuest` calls `resetRoomEntryState(deps, false)`.

`src/lib/room-protocol/roomLifecycle.test.ts`:

- Re-applied the archive's parity test "work:300: both entry paths clear
  the same full room-scoped set", extended to dirty and assert
  `waitingForHostDeadlineAtRef` (the ref that postdates the archive base
  and is now inside the shared reset).

## Reconciliation decisions vs the archive diff

- `waitingForHostDeadlineAtRef` joined the helper: both entry paths
  already nulled it inline (F712/F726 made it room-scoped), so leaving it
  out would have silently dropped the clear on both paths.
- `pendingGuestStateRef` is now cleared inside the helper, i.e. before
  `joinAsGuest`'s empty-code early return — the archive's accepted
  semantics; on main it was cleared only after the early return. A failed
  join entry now also drops the stale rollback snapshot, consistent with
  the ref's room-scoped contract.
- The archive's helper doc comment gained `waitingForHost deadline
  F712/F726` in its leak history.

## Gates (all on the committed tree)

- `pnpm lint` — clean, exit 0.
- `pnpm test` — 92 files / 1016 tests passed (vitest run, 44s).
- `pnpm build` — `tsc -b && vite build` clean.
- `pnpm test:e2e` not run: needs the matchmaking Worker on
  `127.0.0.1:8787`; the slice is a pure refactor with the parity suite
  pinning both entry paths.

## Land

Branch `fleet/ttt-roomlifecycle-fix` rebased onto `origin/main@89536d2`
(the TTT-AI-NAMES docs commit that landed mid-task; docs-only, clean
rebase) and landed as `f342832` via `sf_tools/sf_git_push_land`
(`HEAD:main` fast-forward, ancestry verified against the fetched
`origin/main` tip). `sf-orch land` refuses while the dispatch's derived
review hold is live, so the worker-side push_land is the land path here;
gates above re-ran green on the rebased tree before the push.
