import {
  GameStatus,
  TURN_DURATION_MS,
  PlayerSymbol,
  oppositeSymbol,
} from "@/game/constants";
import { isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { peerLeftUserMessage, PEER_MAX_ERROR_LENGTH } from "@/lib/peer";
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
  /** Last move the reconnect grace reset the timer for (fleet 09-07
   *  finding 2: one full reset per move — repeated reconnects within
   *  the same turn keep the remaining time). */
  reconnectResetsRef: { current: { moveCount: number } };
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
  reconnectResetsRef,
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
        // Host's own reconnect must resync like peer-reconnected does:
        // during the outage the timer kept ticking and may have applied a
        // local-only forced move the guest never saw — broadcast the
        // authoritative state either way, and reset the stale deadline
        // (bounded: once per move, same guard as peer-reconnected) so the
        // first post-reconnect tick can't instantly force a move
        // (fleet needs-work 2026-09-07 P1 / 09-08 P2).
        const current = stateRef.current;
        if (isGameActive(current)) {
          const fullResetAllowed =
            reconnectResetsRef.current.moveCount !== current.moveCount;
          reconnectResetsRef.current.moveCount = current.moveCount;
          const reconciled = fullResetAllowed
            ? {
                ...current,
                turnTimeRemaining: TURN_DURATION_MS,
                turnDeadlineAt: Date.now() + TURN_DURATION_MS,
              }
            : current;
          commitHostState(reconciled);
        } else {
          broadcastGameState(current);
        }
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
      rematchIncoming: false,
    }));
    if (roleRef.current === "host") {
      // After a reconnect grace, the host's local timer may be near zero
      // (the interval kept running) or it may have been paused mid-turn.
      // Reset the wire timer to the full budget and broadcast the new
      // state so the rejoining guest catches up. Without this reset the
      // very next tick can fire a forced random move.
      const current = stateRef.current;
      if (isGameActive(current)) {
        // Bound the reconnect grace (fleet 09-07 finding 2): a full
        // reset is allowed once per move — repeated disconnect/
        // reconnect cycles within the same turn keep the remaining
        // time, so a guest can't stall the timeout indefinitely. The
        // broadcast still catches the rejoining guest up either way.
        const fullResetAllowed =
          reconnectResetsRef.current.moveCount !== current.moveCount;
        reconnectResetsRef.current.moveCount = current.moveCount;
        const reconciled = fullResetAllowed
          ? {
              ...current,
              turnTimeRemaining: TURN_DURATION_MS,
              turnDeadlineAt: Date.now() + TURN_DURATION_MS,
            }
          : current;
        commitHostState(reconciled);
        startTimer();
      } else {
        broadcastGameState(current);
      }
    } else if (roleRef.current === "guest" && isGameActive(stateRef.current)) {
      // Resynthesize a fresh turnDeadlineAt from the remaining time —
      // the old deadline is stale after a disconnect. Without this the
      // guest timer ticks against a past deadline, briefly showing 0
      // and potentially firing the local "ran out of time" branch
      // before the host's gameUpdate arrives (fleet 09-07 P1).
      const current = stateRef.current;
      const remaining = current.turnTimeRemaining ?? TURN_DURATION_MS;
      const resynthesized = {
        ...current,
        turnDeadlineAt: Date.now() + remaining,
      };
      stateRef.current = resynthesized;
      setState((prev) =>
        prev.gameState === current
          ? { ...prev, gameState: resynthesized }
          : prev,
      );
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
          rematchIncoming: false,
        };
      });
      return;
    }
    if (roleRef.current !== "guest" && roleRef.current !== "host") return;
    stopTimer();
    hostRematchPendingRef.current = false;
    const current = stateRef.current;
    const leaveReason = reason === "expired" ? "expired" : "closed";
    setState((prev) => {
      if (prev.status === "disconnected") return prev;
      // Crown the surviving side's symbol — prefer the live ref, fall back
      // to the symbol recorded in state. Symbols randomize each rematch
      // (randomPlayerSymbol), so a hardcoded X/O default crowns the wrong
      // winner when the ref is momentarily null. If we never learned the
      // symbol (leave before assignment), crown nobody rather than guess.
      const mySymbol =
        roleRef.current === "guest"
          ? (guestSymbolRef.current ?? prev.guestSymbol)
          : (hostSymbolRef.current ?? prev.hostSymbol);
      const gameState =
        current.winner || mySymbol === null
          ? current
          : { ...current, winner: mySymbol, gameStatus: GameStatus.COMPLETED };
      stateRef.current = gameState;
      return {
        ...prev,
        status: "disconnected",
        gameState,
        message: peerLeftUserMessage(roleRef.current === "guest" ? "guest" : "host", leaveReason),
        rematchIncoming: false,
      };
    });
    return;
  }
  if (event.type === "error") {
    // Cap message length — a hostile relay or injected error could
    // send an arbitrarily long string (fleet audit 2026-09-06 P4).
    // Validate message is a string; reject non-string values from a
    // malicious or buggy relay (fleet needs-work 2026-09-07 P2).
    const msg = (event as { message?: unknown }).message;
    const raw = typeof msg === "string" ? msg : "Room error";
    setState((prev) => ({
      ...prev,
      message: raw.slice(0, PEER_MAX_ERROR_LENGTH),
    }));
    return;
  }
}
