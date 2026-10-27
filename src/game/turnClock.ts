import { TURN_DURATION_MS } from "./constants";

/**
 * The turn clock's two arithmetic moves, in one place.
 *
 * A turn has an absolute `turnDeadlineAt` on the authoritative clock, but the
 * wire carries only `turnTimeRemaining` (the host's absolute deadline is
 * meaningless on a peer's clock). Converting between the two is the same two
 * expressions everywhere, and they had been written out six times with three
 * slightly different guards:
 *
 *   src/hooks/peer-room/turnTimer.ts        freeze + fallback rebuild
 *   src/hooks/localTurnTimer.ts             freeze + fallback rebuild
 *   src/hooks/usePeerRoom.ts                freeze (guarded) + rebuild (host only)
 *   src/hooks/useLocalGame.ts               freeze (guarded) + rebuild
 *   src/hooks/peer-room/guestProtocol.ts    rebuild from the wire
 *   src/hooks/peer-room/relayEvents.ts      rebuild after a disconnect
 *
 * The HOST/GUEST asymmetry around these calls is deliberate and stays where it
 * is (F226: a guest must not rebuild a deadline on resume, because its
 * deadline stayed truthful while only the display froze). This module owns the
 * arithmetic only — never the decision to call it.
 *
 * Pure and React-free by contract: `src/game/` is the engine, and
 * `engine-purity.test.ts` enforces that.
 */

/**
 * How much time is left on `deadlineAt` at `now`, never negative.
 *
 * A missing deadline means the state never carried one (the wire strips it), so
 * the remaining budget is the full turn — the same fallback the timers used
 * inline. A clock that has already passed clamps to 0 rather than reporting a
 * negative remainder, which would read as "time left: -2s".
 */
export function freezeRemaining(
  deadlineAt: number | undefined,
  now: number,
): number {
  const deadline = deadlineAt ?? now + TURN_DURATION_MS;
  return Math.max(0, deadline - now);
}

/**
 * The absolute deadline a remaining budget corresponds to on THIS clock.
 *
 * Used on resume (after a pause the deadline would otherwise have aged) and
 * after a reconnect (the old deadline is stale), and on the guest whenever the
 * host sends a budget instead of a clock.
 */
export function rebuildDeadline(
  remaining: number | undefined,
  now: number,
): number {
  return now + (remaining ?? TURN_DURATION_MS);
}
