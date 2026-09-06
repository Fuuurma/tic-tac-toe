import { GameStatus, TURN_DURATION_MS, PlayerSymbol } from "@/game/constants";
import { isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { PeerMessage } from "@/lib/peer";
import type { PeerRoomState } from "../usePeerRoom";

/**
 * Guest-side game protocol, extracted from usePeerRoom (god-hook
 * decomposition, slice 3).
 *
 * The guest treats the host as authoritative: `joined`/`gameStart`/
 * `gameUpdate` snapshots replace local state (and clear the optimistic
 * rollback snapshot), rematch prompts are display-only, and a host
 * `leave` ends the game with the guest as winner by forfeit.
 */
export interface GuestProtocolDeps {
  stateRef: { current: GameState };
  guestSymbolRef: { current: PlayerSymbol | null };
  /** Optimistic-move rollback snapshot; cleared ONLY on an
   *  authoritative host update (never in the ref-sync effect). */
  pendingGuestStateRef: { current: GameState | null };
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  stopTimer: () => void;
}

/**
 * Handles one peer message addressed to the guest (routed by role in
 * buildRoomClient).
 */
export function handleGuestMessage(deps: GuestProtocolDeps, message: PeerMessage) {
  const {
    stateRef,
    guestSymbolRef,
    pendingGuestStateRef,
    setState,
    stopTimer,
  } = deps;
  {
    if (message.type === "joined" || message.type === "gameStart" || message.type === "gameUpdate") {
      const gameState =
        message.gameState.turnDeadlineAt === undefined &&
        isGameActive(message.gameState)
          ? {
              ...message.gameState,
              turnDeadlineAt:
                Date.now() +
                (message.gameState.turnTimeRemaining ?? TURN_DURATION_MS),
            }
          : message.gameState;
      stateRef.current = gameState;
      // An authoritative state update supersedes any pending optimistic
      // move, so clear the rollback snapshot. This is the ONLY place we
      // clear it — the ref-sync effect does NOT clear it because that
      // effect also fires on the guest's own optimistic move.
      pendingGuestStateRef.current = null;
      if (message.type === "joined" && message.symbol) {
        guestSymbolRef.current = message.symbol;
      }
      setState((prev) => {
        const localSymbol =
          message.type === "joined" && message.symbol
            ? message.symbol
            : prev.guestSymbol;
        return {
          ...prev,
          status: "connected",
          gameState,
          guestSymbol: localSymbol,
          message: "",
        };
      });
      return;
    }
    if (message.type === "rematchRequested") {
      const state = stateRef.current;
      setState((prev) => ({
        ...prev,
        message: `${state.players[message.requesterSymbol].username} wants a rematch. Click Play Again to accept.`,
      }));
      return;
    }
    if (message.type === "rematchCancel") {
      // Host withdrew a pending rematch request before the guest responded.
      // Clear the prompt so the guest UI no longer offers accept/decline.
      setState((prev) =>
        /wants a rematch/i.test(prev.message)
          ? { ...prev, message: "Rematch request withdrawn" }
          : prev,
      );
      return;
    }
    if (message.type === "leave") {
      // Host explicitly left. The close event will follow, but we can
      // show a more specific message now.
      stopTimer();
      const current = stateRef.current;
      const guestSymbol = guestSymbolRef.current ?? PlayerSymbol.O;
      const gameState = current.winner
        ? current
        : { ...current, winner: guestSymbol, gameStatus: GameStatus.COMPLETED };
      stateRef.current = gameState;
      setState((prev) => ({
        ...prev,
        status: "disconnected",
        gameState,
        message: "Host left the game",
      }));
      return;
    }
    if (message.type === "error") {
      setState((prev) => ({ ...prev, message: message.message }));
      return;
    }
  }
}