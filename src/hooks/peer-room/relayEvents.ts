import {
  GameStatus,
  TURN_DURATION_MS,
  PlayerSymbol,
  oppositeSymbol,
} from "@/game/constants";
import { isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { peerLeftUserMessage } from "@/lib/peer";
import type { PeerRole } from "../usePeerRoom";
import type { PeerRoomState } from "../usePeerRoom";

/**
 * Relay lifecycle-event handling, extracted from usePeerRoom (god-hook
 * decomposition, slice 2).
 *
 * These are the Durable-Object relay's envelope events — welcome,
 * peer-joined/-reconnected/-left, error — as opposed to the game
 * protocol messages in hostProtocol/guestProtocol. They drive the
 * connection status machine and the host's reconnect reconciliation.
 */
export interface RelayEventDeps {
  stateRef: { current: GameState };
  roleRef: { current: PeerRole };
  hostSymbolRef: { current: PlayerSymbol | null };
  guestSymbolRef: { current: PlayerSymbol | null };
  hostRematchPendingRef: { current: boolean };
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  commitHostState: (gameState: GameState) => void;
  broadcastGameState: (gameState: GameState) => void;
  startTimer: () => void;
  stopTimer: () => void;
}

/** Handles one relay lifecycle event (routed by type in buildRoomClient). */
export function handleRelayEvent(
  deps: RelayEventDeps,
  event: { type: string; [k: string]: unknown },
) {
  const {
    stateRef,
    roleRef,
    hostSymbolRef,
    guestSymbolRef,
    hostRematchPendingRef,
    setState,
    commitHostState,
    broadcastGameState,
    startTimer,
    stopTimer,
  } = deps;
  if (event.type === "welcome") {
    const role = (event as { role?: string }).role;
    const opponent = (event as { opponent?: { guestId: string; displayName: string } | null }).opponent ?? null;
    if (role === "host") {
      // Host wakes up (initial or reconnect). If opponent present, they're
      // already back; if not, wait for peer-joined.
      if (opponent) {
        // Host reconnects with opponent present — restart the turn
        // timer. Without this the timer stays stopped from the
        // peer-left:disconnect event and the host's display is frozen
        // (fleet audit 2026-09-06 P2-2).
        setState((prev) => ({
          ...prev,
          role: "host",
          status: "connected",
          guestSymbol: oppositeSymbol(hostSymbolRef.current ?? PlayerSymbol.X),
          message: "",
        }));
        startTimer();
      } else {
        setState((prev) => ({
          ...prev,
          role: "host",
          status: prev.status === "connected" ? "connected" : "waiting",
          message: prev.status === "connected" ? "" : `Room ${prev.roomId}. Waiting for opponent.`,
        }));
      }
    } else if (role === "guest") {
      // Guest received welcome from the relay. The host will follow with
      // `joined` (carrying our assigned symbol + initial game state), but
      // record our role/status now so we don't sit in "connecting"
      // indefinitely if `joined` is delayed or never arrives. The symbol
      // is still derived from `joined`; welcome only confirms the relay
      // accepted us and tells us whether the host is already present.
      roleRef.current = "guest";
      setState((prev) => ({
        ...prev,
        role: "guest",
        status: opponent ? "connected" : "connecting",
        message: opponent ? "" : "Waiting for host…",
      }));
    }
    return;
  }
  if (event.type === "peer-reconnected") {
    setState((prev) => ({
      ...prev,
      status: "connected",
      message: "",
    }));
    if (roleRef.current === "host") {
      // After a reconnect grace, the host's local timer may be near zero
      // (the interval kept running) or it may have been paused mid-turn.
      // Reset the wire timer to the full budget and broadcast the new
      // state so the rejoining guest catches up. Without this reset the
      // very next tick can fire a forced random move.
      const current = stateRef.current;
      if (isGameActive(current)) {
        const reconciled = {
          ...current,
          turnTimeRemaining: TURN_DURATION_MS,
          turnDeadlineAt: Date.now() + TURN_DURATION_MS,
        };
        commitHostState(reconciled);
        startTimer();
      } else {
        broadcastGameState(current);
      }
    } else if (roleRef.current === "guest" && isGameActive(stateRef.current)) {
      startTimer();
    }
    return;
  }
  if (event.type === "peer-joined") {
    // Host learns a new peer arrived at the relay. The guest will send
    // its real `join` message (with preferred color) immediately after
    // `welcome`, so we only update status here — do NOT synthesize a
    // join, which would build game state with a wrong hardcoded color
    // and then be overwritten by the real join moments later.
    setState((prev) =>
      prev.status === "connected"
        ? prev
        : {
            ...prev,
            status: "connecting",
            message: "Opponent connecting…",
          },
    );
    return;
  }
  if (event.type === "peer-left") {
    const reason = (event as { reason?: "disconnect" | "closed" | "expired" }).reason;
    if (reason === "disconnect") {
      // Don't override a deliberate leave/forfeit — the host/guest
      // protocol sets status to "disconnected" + winner before the
      // relay's transient disconnect event arrives. Without this guard
      // the disconnect flips it back to "reconnecting" for the 30s
      // grace, hiding the forfeit result (fleet audit 2026-09-06 P2-1).
      setState((prev) => {
        if (prev.status === "disconnected") return prev;
        stopTimer();
        return {
          ...prev,
          status: "reconnecting",
          message: peerLeftUserMessage(roleRef.current === "guest" ? "guest" : "host", "disconnect"),
        };
      });
      return;
    }
    if (roleRef.current !== "guest" && roleRef.current !== "host") return;
    stopTimer();
    hostRematchPendingRef.current = false;
    const current = stateRef.current;
    const winnerSymbol =
      roleRef.current === "guest"
        ? (guestSymbolRef.current ?? PlayerSymbol.O)
        : (hostSymbolRef.current ?? PlayerSymbol.X);
    const gameState = current.winner
      ? current
      : { ...current, winner: winnerSymbol, gameStatus: GameStatus.COMPLETED };
    stateRef.current = gameState;
    const leaveReason = reason === "expired" ? "expired" : "closed";
    setState((prev) => {
      if (prev.status === "disconnected") return prev;
      return {
        ...prev,
        status: "disconnected",
        gameState,
        message: peerLeftUserMessage(roleRef.current === "guest" ? "guest" : "host", leaveReason),
      };
    });
    return;
  }
  if (event.type === "error") {
    setState((prev) => ({
      ...prev,
      message: String((event as { message?: string }).message ?? "Room error"),
    }));
    return;
  }
}
