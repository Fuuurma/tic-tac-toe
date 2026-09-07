# Resync & rollback protocol — design notes

Fleet queued slice 2026-09-07 · status: design, not implemented
(supersedes the vague "rollback protocol (error carries seq + per-seq
snapshots)" queue note — see §4 for why that design is over-engineered
for this game).

## 1. Current mechanism (as of 31df599 / 87636d6)

**Optimistic guest move.** The guest applies its move locally and
stores the pre-move state in `pendingGuestStateRef` (a single-slot
rollback snapshot). The authoritative `gameUpdate` from the host
clears it; so does any resync `joined`.

**Host rejection.** The host validates every guest move. On an invalid
move it sends `error: "Invalid move"`; the guest rolls back to
`pendingGuestStateRef` (guestProtocol.ts ~110-130).

**Reconnect resync.** On `hello` from a guest while a game is active,
the host answers `resync` with its current `GameState`
(peer.ts `applyHostGuestJoin`). The guest's protocol synthesizes
`turnDeadlineAt = now + turnTimeRemaining` ONLY when the incoming
state has `turnDeadlineAt === undefined`.

## 2. Known gaps

1. **Stale defined deadline on resync.** If the host's live state
   carries a `turnDeadlineAt` computed before a long disconnect, the
   guest honors it verbatim — the timer can show 0/expired for a turn
   that should have been ticking (or vice versa if the host kept
   ticking during the split). Synthesis only covers the undefined
   case.
2. **No freshness signal on resync.** The resync payload has no
   timestamp, so the guest cannot tell fresh state from stale state.

## 3. Proposed design (small, host-authoritative)

On resync, the HOST recomputes the deadline from its own clock before
sending:

- `peer.ts` resync branch: attach `resyncedAt: Date.now()` and keep
  `turnTimeRemaining` as the authoritative remaining-time source;
  leave `turnDeadlineAt` undefined in resync payloads.
- The guest's existing synthesis path (now + turnTimeRemaining) then
  always produces a fresh deadline — no new message type, no seq, no
  clock sync. One-line producer change; consumer already correct.

This resolves gap 1 + 2 with the smallest possible diff and reuses the
path the guest already handles.

## 4. Why NOT seq + per-seq snapshots

The queued idea (error carries seq; guest keeps per-seq snapshots)
matters for transports where multiple actions can be in flight, so a
rejection needs to name WHICH action failed. Tic-tac-toe is strict
alternation: the guest has exactly one outstanding optimistic move
between its turn starting and the host's authoritative echo. A single
snapshot + "Invalid move" is unambiguous by construction. Adding seqs
would add protocol surface (and a migration for in-flight peers) to
solve a state that cannot occur. Revisit only if the transport is
reused for a game with simultaneous actions.

## 5. Test plan (when implemented)

- Resync during an active guest turn: synthesized deadline is
  now + remaining (already covered by existing guest tests — pin the
  resync branch with an explicit stale-deadline fixture).
- Host rejection with no snapshot: no-op (already covered).
- Host rejection after TWO guest moves is unreachable by alternation —
  document, don't test.

## 6. Implementation order

1. Host: strip/omit `turnDeadlineAt` in the resync payload; include
   `turnTimeRemaining` computed from the host clock at send time.
2. Guest: no change (synthesis already handles undefined).
3. Pin with a test fixture asserting the resync payload shape.
