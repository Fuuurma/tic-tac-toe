import { GameStatus, TURN_DURATION_MS, PlayerSymbol } from "@/game/constants";
import { isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { applyForfeitIfActive, type PeerMessage } from "@/lib/peer";
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
  /** True while THIS guest has an unanswered rematch request out. The host
   *  gates its prompt on the same flag, so without it here both sides can
   *  prompt at once and each waits 30s on the other. */
  rematchPendingRef: { current: boolean };
  /** Cancels this guest's rematch-expiry timer. */
  clearRematchTimeout: () => void;
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
    rematchPendingRef,
    clearRematchTimeout,
    setState,
    stopTimer,
  } = deps;
  {
    if (message.type === "joined" || message.type === "gameStart" || message.type === "gameUpdate" || message.type === "state_snapshot") {
      // Anchor the deadline to THIS clock: the wire state carries only
      // `turnTimeRemaining` (toWireGameState strips the host's absolute
      // deadline), so `now + remaining` is skew-free. A deadline that does
      // arrive (older/hostile peer) is still host-clock — ignore it and
      // synthesize the same way.
      const gameState = isGameActive(message.gameState)
        ? {
            ...message.gameState,
            turnDeadlineAt:
              Date.now() +
              (message.gameState.turnTimeRemaining ?? TURN_DURATION_MS),
          }
        : message.gameState;
      // Capture the rollback snapshot BEFORE clearing it. The host cannot
      // send an `error` (the relay reserves that type and bounces it back to
      // the sender), so it resyncs with a plain authoritative update instead.
      // An update whose moveCount still equals the pre-move snapshot means
      // the host rejected our optimistic move — say so, rather than letting
      // the mark silently vanish.
      const pending = pendingGuestStateRef.current;
      const moveRejected =
        pending !== null && pending.moveCount === message.gameState.moveCount;
      stateRef.current = gameState;
      // An authoritative state update supersedes any pending optimistic
      // move, so clear the rollback snapshot. This is the ONLY place we
      // clear it — the ref-sync effect does NOT clear it because that
      // effect also fires on the guest's own optimistic move.
      pendingGuestStateRef.current = null;
      if (message.type === "joined" && message.symbol) {
        guestSymbolRef.current = message.symbol;
      }
      // On gameStart (including rematch with symbol swap), update the
      // guest's symbol from the host's authoritative assignment.
      if (message.type === "gameStart" && message.symbol) {
        guestSymbolRef.current = message.symbol;
      }
      // A new game supersedes any request of ours that is still out: the
      // host answering it IS the accept. Leaving the flag set would make the
      // guest cancel a request nobody is waiting on, and block it from
      // asking for a third game until the 30s expiry fired.
      if (message.type === "gameStart") {
        rematchPendingRef.current = false;
        clearRematchTimeout();
      }
      setState((prev) => {
        const localSymbol =
          message.type === "joined" && message.symbol
            ? message.symbol
            : message.type === "gameStart" && message.symbol
              ? message.symbol
              : prev.guestSymbol;
        return {
          ...prev,
          status: "connected",
          gameState,
          guestSymbol: localSymbol,
          message: moveRejected ? "Move was rejected by host" : "",
          rematchOutgoing: message.type === "gameStart" ? false : prev.rematchOutgoing,
          // A terminal frame (state_snapshot/joined resync on a finished
          // game) does not supersede a live rematch prompt — only a new
          // ACTIVE game does (review 2026-10-03 P3).
          rematchIncoming: isGameActive(gameState) ? false : prev.rematchIncoming,
        };
      });
      return;
    }
    if (message.type === "rematchRequested") {
      const state = stateRef.current;
      // F191: mirror the host-side accept gate — a rematch prompt is only
      // meaningful on a terminal game. A mid-game request from a hostile
      // or buggy host must not pop the prompt over live play.
      if (state.winner === null || state.gameStatus !== GameStatus.COMPLETED) return;
      // Mirror the host's own pending gate (hostProtocol rematchRequested):
      // only one request may be in flight. Without this, a mutual ask leaves
      // both sides showing a prompt plus a "waiting for opponent" cancel,
      // each waiting 30s on the other with no way to settle it.
      if (rematchPendingRef.current) return;
      setState((prev) =>
        // A prompt already up is a no-op: answering one request and asking
        // another would leave both players waiting.
        prev.rematchIncoming
          ? prev
          : {
              ...prev,
              message: `${state.players[message.requesterSymbol].username} wants a rematch. Accept or decline below.`,
              rematchIncoming: true,
            },
      );
      return;
    }
    if (message.type === "rematchCancel") {
      // Host withdrew a pending rematch request before the guest responded.
      // Clear the prompt so the guest UI no longer offers accept/decline.
      // Gate on the explicit rematchIncoming flag — never on the
      // user-facing message copy.
      setState((prev) =>
        prev.rematchIncoming
          ? { ...prev, message: "Rematch request withdrawn", rematchIncoming: false }
          : prev,
      );
      return;
    }
    if (message.type === "leave") {
      // Host explicitly left. The close event will follow, but we can
      // show a more specific message now.
      stopTimer();
      const current = stateRef.current;
      setState((prev) => {
        // Symbols randomize per rematch — prefer the live ref, fall back
        // to the state-recorded symbol, and crown nobody rather than
        // guess X/O when neither is known yet.
        const guestSymbol = guestSymbolRef.current ?? prev.guestSymbol;
        const gameState = applyForfeitIfActive(current, guestSymbol);
        stateRef.current = gameState;
        return {
          ...prev,
          status: "disconnected" as const,
          gameState,
          message: "Host left the game",
          rematchIncoming: false,
        };
      });
      return;
    }
    if (message.type === "error") {
      // Diagnostics only. The host can NEVER deliver a move rejection here:
      // the relay reserves the `error` type and answers a client-sent one
      // back to the sender, so the old rollback branch was unreachable and
      // an optimistic-move rejection silently diverged the two boards.
      // Rejection now arrives as an authoritative state whose moveCount still
      // matches the rollback snapshot — detected in the branch above. What
      // does reach this handler is the relay complaining about a frame THIS
      // client sent, which is worth showing.
      setState((prev) =>
        prev.message === message.message
          ? prev
          : { ...prev, message: message.message },
      );
      return;
    }
  }
}