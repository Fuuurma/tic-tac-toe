# Test-file audit — tic-tac-toe — 2026-10-03

Scope: every `*.test.*` under `src/` plus `e2e/` (fleet test-file audit 7/8).
Baseline: `pnpm vitest run` → 25 files / 247 tests green on main `fc32580`,
~2s wall. Cheap suite — no runtime bloat.

## Verdict: keep the suite essentially as-is

This is the reference suite the audit doctrine aims at: nearly every file is a
regression lock with a cited incident, or a contract on a real seam. No
file-level slop found — nothing deleted.

| Class | Files | Verdict |
|---|---|---|
| Engine / AI | `logic`, `engine-purity` (injected `now`), `ai.test`, `ai.behavior`, `ai.bench`, `ai.selfplay` | keep — difficulty separation, move-time budget, self-play safety, 3-piece eviction-win interaction |
| Transport / protocol | `room` (lifecycle + close-during-connect contract), `peer`, `peer.hostile`, `__tests__/peerProtocol` (rollback + rematch-identity locks, F191), `hostProtocol`, `relayEvents`, `roomLifecycle`, `matchmaking`, `rematchTimeout` | keep — these are the seams the whole online mode hangs on |
| Input / identity | `roomId` (`../admin` traversal + length caps), `identity` (sanitize/persist roundtrip), `errorReporting` (boundary→ingest routing, idempotent install) | keep — real validation contracts, not copy-pins |
| Component behavior | `playersPanel` (rematch CTA state machine), `symbolShapePicker` (a11y regression — asserts visible textContent specifically *not* aria-label, incident comment in-file), `playerSettingsSheet`, `radioGroup` (a11y keyboard wrap/Home/End) | keep — behavioral, each cites the bug it locks |
| Config shape | `PLAYER_CONFIG` block inside `logic.test.ts` (4 lines, truthy label + one default color) | marginal-keep — weakest test in the suite; not worth a branch alone. If it ever breaks on a copy change, delete it then |

## What the suite does well (patterns worth copying to other repos)

- **Incident-cited regression locks**: `symbolShapePicker.test.tsx` comments
  name the exact bug class (aria-label satisfied while sighted users saw
  unlabeled tiles) and deliberately assert `textContent` instead of
  `getByRole(name:)`, which the bug would have passed.
- **Protocol cores tested without React**: `guestProtocol`/`hostProtocol` take
  ref deps as plain objects — the rematch identity swap and misplaced rollback
  were testable only because the handlers are decoupled from hook wiring.
- **Generated-domain honesty**: `player-properties.test.ts` (property suite)
  constrains boards to at-most-one-winner because two-winner boards are
  unreachable in play and make `checkWinner` scan-order-dependent.

## Gaps — already covered by open WORK rows, not new findings

- **E2E protocol skew**: `waiting-room` spec fails against the stale sibling
  `fuurma-matchmaking` workerd (serves pre-MM-01 relay; client port in-flight
  on `session/ttt-mm01`). Reachability ≠ compatibility — the spec is correct
  to hold.
- **Shared-module drift**: `src/lib/room.ts` is copy-pasted with uno-chess;
  both carried the same `void client.connect()` dropped-promise bug (fixed
  here in `8c048b0`, there in the copy-pin branch). WORK row open.

## Actions taken

- None in this repo — the suite needed no deletion branch. Filed gaps were
  already queued.
