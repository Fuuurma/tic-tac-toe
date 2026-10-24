import { isGameActive, makeMove, makeRandomMove } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { TURN_DURATION_MS } from "@/game/constants";
import type { PeerRole } from "../usePeerRoom";
import type { PeerRoomState } from "../usePeerRoom";

/**
 * Turn-clock controller for online play, extracted from usePeerRoom
 * (god-hook decomposition, slice 1).
 *
 * The deadline lives on the authoritative game state; this interval
 * only maintains the LOCAL `turnTimeRemaining` display and — on the
 * host, whose clock is the game's authority — fires the forced random
 * move when a turn expires. Ticking never creates wire traffic.
 */
export interface TurnTimerDeps {
  /** Authoritative current game state (kept current by the hook). */
  stateRef: { current: GameState };
  /** Local peer role; only the host may force a move on expiry. */
  roleRef: { current: PeerRole };
  /** Interval handle, owned by the hook as a useRef. */
  tickRef: { current: number | null };
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  broadcastGameState: (gameState: GameState) => void;
}

/** Stops the turn-clock interval (no-op when not running). */
export function stopTurnTimer(deps: Pick<TurnTimerDeps, "tickRef">) {
  if (deps.tickRef.current !== null) {
    window.clearInterval(deps.tickRef.current);
    deps.tickRef.current = null;
  }
}

/** Starts (or restarts) the 1s turn-clock tick. Call from effects or
 *  event handlers — never during render. */
export function startTurnTimer(deps: TurnTimerDeps) {
  const { stateRef, roleRef, tickRef, setState, broadcastGameState } = deps;
  stopTurnTimer(deps);
  tickRef.current = window.setInterval(() => {
    let current = stateRef.current;
    if (!isGameActive(current)) {
      stopTurnTimer(deps);
      return;
    }

    const deadline =
      current.turnDeadlineAt ??
      Date.now() + (current.turnTimeRemaining ?? TURN_DURATION_MS);
    if (current.turnDeadlineAt === undefined) {
      current = { ...current, turnDeadlineAt: deadline };
      stateRef.current = current;
    }

    const remaining = Math.max(0, deadline - Date.now());
    if (remaining <= 0) {
      if (roleRef.current !== "host") {
        setState((prev) =>
          prev.gameState.turnDeadlineAt === deadline
            ? { ...prev, gameState: { ...prev.gameState, turnTimeRemaining: 0 } }
            : prev,
        );
        stopTurnTimer(deps);
        return;
      }
      const random = makeRandomMove(current.board);
      if (random === null) {
        stopTurnTimer(deps);
        return;
      }
      const updated = makeMove(current, random);
      if (!updated) {
        stopTurnTimer(deps);
        return;
      }
      const gameState = updated;
      stateRef.current = gameState;
      setState((prev) => ({
        ...prev,
        gameState,
        message: `${current.players[current.currentPlayer].username || "Player"} ran out of time`,
      }));
      broadcastGameState(gameState);
      return;
    }

    // Timer display is local state only. The deadline is part of the last
    // authoritative snapshot, so ticking no longer creates wire traffic.
    setState((prev) =>
      prev.gameState.turnDeadlineAt === deadline
        ? { ...prev, gameState: { ...prev.gameState, turnTimeRemaining: remaining } }
        : prev,
    );
  }, 1000);
}
