import { makeMove, makeRandomMove } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { GameStatus, TURN_DURATION_MS } from "@/game/constants";

/**
 * Turn-clock controller for local play, extracted from useLocalGame
 * (mirroring peer-room/turnTimer.ts — the local hook is its own
 * authority, so there is no role gate and no wire broadcast).
 *
 * The deadline lives on the game state; this interval only maintains
 * the `turnTimeRemaining` display and fires the forced random move when
 * a turn expires. A forced move also raises the "ran out of time"
 * status message, which the next applied move — or a reset — clears.
 */
export interface LocalTurnTimerDeps {
  /** Latest committed game state (kept current by the hook). */
  stateRef: { current: GameState };
  /** Interval handle, owned by the hook as a useRef. */
  tickRef: { current: number | null };
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  /**
   * Status-line setter. Already supplied by every caller — `useLocalGame`
   * passes its own `setMessage` into `startLocalTurnTimer` — and required by
   * `commitLocalMove`, so it belongs on the contract rather than being
   * reached for through a widened `Pick`. It was missing here, which is why
   * `tsc -b` failed on a clean tree: the call sites were correct and the type
   * was behind them.
   */
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}

/** Stops the turn-clock interval (no-op when not running). */
export function stopLocalTurnTimer(deps: Pick<LocalTurnTimerDeps, "tickRef">) {
  if (deps.tickRef.current !== null) {
    window.clearInterval(deps.tickRef.current);
    deps.tickRef.current = null;
  }
}

/**
 * Applies a move precomputed off `prev` (the latest committed
 * snapshot). The guarded updater drops the commit when a concurrent
 * update landed first; clearing the notice is safe either way — a stale
 * snapshot means another commit already ran and owns the status line.
 *
 * `rebase` handles the case where the concurrent update is *not* a rival
 * move. The turn clock rewrites `turnTimeRemaining` onto a fresh object
 * every second, and the AI's move is scheduled 700–1300ms after the turn
 * starts — so roughly half of all AI moves land in the same batch as a
 * clock tick. Dropping them stranded the AI's turn until it expired, so
 * `rebase` re-derives the same move from whatever state did commit. It
 * must stay pure (StrictMode double-invokes updaters) and must return the
 * state unchanged when another move genuinely owns the board.
 */
export function commitLocalMove(
  deps: Pick<LocalTurnTimerDeps, "setGameState" | "setMessage">,
  prev: GameState,
  next: GameState,
  rebase?: (cur: GameState) => GameState,
) {
  deps.setGameState((cur) => (cur === prev ? next : rebase ? rebase(cur) : cur));
  deps.setMessage("");
}

/** Starts (or restarts) the 1s turn-clock tick. Call from effects or
 *  event handlers — never during render. */
export function startLocalTurnTimer(deps: LocalTurnTimerDeps) {
  const { stateRef, tickRef, setGameState } = deps;
  stopLocalTurnTimer(deps);
  tickRef.current = window.setInterval(() => {
    // Updaters must stay pure (StrictMode double-invokes them), so the
    // impure work — Date.now() and the random forced move — runs here
    // off the latest snapshot, matching peer-room turnTimer. The
    // updater then only applies the precomputed result when the state
    // is still the snapshot we decided from; a concurrent commit
    // (click, AI move) makes the next tick recompute fresh.
    const prev = stateRef.current;
    if (prev.winner !== null || prev.gameStatus !== GameStatus.ACTIVE) return;
    // Use the absolute deadline so the timer stays correct even when
    // the browser throttles setInterval in background tabs. Falls back
    // to decrementing turnTimeRemaining when no deadline is set.
    const deadline =
      prev.turnDeadlineAt ??
      Date.now() + (prev.turnTimeRemaining ?? TURN_DURATION_MS);
    const remaining = Math.max(0, deadline - Date.now());
    if (remaining <= 0) {
      const random = makeRandomMove(prev.board);
      if (random === null) return;
      const updated = makeMove(prev, random);
      if (!updated) return;
      setGameState((cur) =>
        cur === prev
          ? {
              ...updated,
              turnNotice: `${
                prev.players[prev.currentPlayer].username || "Player"
              } ran out of time`,
            }
          : cur,
      );
      return;
    }
    const next = { ...prev, turnTimeRemaining: remaining, turnDeadlineAt: deadline };
    setGameState((cur) => (cur === prev ? next : cur));
  }, 1000);
}
