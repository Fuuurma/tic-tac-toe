import { useCallback, useEffect, useRef, useState } from "react";
import { Color, GameModes, GameStatus, PlayerSymbol, SymbolShape } from "@/game/constants";
import { freshGameState, isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { applyAuthorizedMove } from "@/lib/peer";
import type { PeerMessage } from "@/lib/peer";
import { RoomClient } from "@/lib/room";
import {
  startTurnTimer,
  stopTurnTimer,
} from "./peer-room/turnTimer";
import { handleRelayEvent } from "./peer-room/relayEvents";
import { abandonTicket, runQuickMatch } from "./peer-room/matchmaking";
import {
  joinAsGuest as joinAsGuestImpl,
  leaveRoom,
  startAsHost as startAsHostImpl,
} from "./peer-room/roomLifecycle";
import { applyHostMove as applyHostMoveMsg, handleHostMessage } from "./peer-room/hostProtocol";
import { handleGuestMessage } from "./peer-room/guestProtocol";

/**
 * Online play hook for tic-tac-toe.
 *
 * Transport: Cloudflare Durable Object WebSocket relay inside the shared
 * `fuurma-matchmaking` Worker. The hook preserves the same public API so the
 * consuming surface (`OnlineGameSurface`) doesn't need to branch.
 *
 * Spec: hub/migrations/2026-07-games-do-websocket-migration.md
 */

export type PeerRole = "host" | "guest" | null;

export type PeerStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface PeerRoomState {
  role: PeerRole;
  status: PeerStatus;
  roomId: string;
  hostSymbol: PlayerSymbol | null;
  guestSymbol: PlayerSymbol | null;
  message: string;
  gameState: GameState;
}

/**
 * Pending host-side settings that the user changed via the in-game edit
 * button. Stored on the host only; the guest cannot edit a peer's identity.
 */
export interface PendingPlayerSettings {
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

const initialState: PeerRoomState = {
  role: null,
  status: "idle",
  roomId: "",
  hostSymbol: null,
  guestSymbol: null,
  message: "",
  gameState: freshGameState(),
};

export interface PeerRoomOptions {
  hostDisplayName: string;
  hostColor: Color;
  hostShape?: SymbolShape;
  gameMode: typeof GameModes.ONLINE;
}

export function usePeerRoom(options: PeerRoomOptions) {
  const [state, setState] = useState<PeerRoomState>(initialState);
  const roomRef = useRef<RoomClient | null>(null);
  const stateRef = useRef<GameState>(initialState.gameState);
  const hostSymbolRef = useRef<PlayerSymbol | null>(null);
  const guestSymbolRef = useRef<PlayerSymbol | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const tickRef = useRef<number | null>(null);
  const matchmakingTicketRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);
  // Host remembers when it has issued a rematch request. A guest `rematchAccept`
  // is only honored while a host request is pending and the game is terminal.
  // Without this gate a hostile or buggy guest can reset the host mid-game.
  const hostRematchPendingRef = useRef(false);
  // Host remembers player settings (name/color/shape) the user edited from
  // the in-game edit button. Those changes only apply on the next rematch so
  // the live game is never mutated while it's in progress.
  const hostPendingSettingsRef = useRef<PendingPlayerSettings | null>(null);
  // Guest remembers the authoritative state right before applying an
  // optimistic move. If the host rejects the move via `{type:"error", message:"Invalid move"}`,
  // we roll back so the UI does not drift from the relay's source of truth.
  const pendingGuestStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    stateRef.current = state.gameState;
    roleRef.current = state.role;
    guestSymbolRef.current = state.guestSymbol;
    // NOTE: pendingGuestStateRef is NOT cleared here. The effect runs on
    // every state change, including the guest's own optimistic move. If we
    // cleared it here, the rollback path (host rejects move) would see null
    // and the guest would be stuck with an incorrect board. Instead, the
    // ref is cleared in handleGuestData only when an authoritative state
    // update (joined/gameStart/gameUpdate) arrives from the host.
  }, [state.gameState, state.role, state.guestSymbol]);

  const update = useCallback((patch: Partial<PeerRoomState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const broadcastGameState = useCallback((gameState: GameState) => {
    roomRef.current?.send({ type: "gameUpdate", gameState });
  }, []);

  const commitHostState = useCallback(
    (gameState: GameState) => {
      stateRef.current = gameState;
      setState((prev) => ({ ...prev, gameState }));
      broadcastGameState(gameState);
    },
    [broadcastGameState],
  );

  // Turn clock + host/guest protocols live in peer-room modules
  // (god-hook decomposition); this hook is the composition root.
  const turnTimerDeps = useCallback(
    () => ({ stateRef, roleRef, tickRef, setState, broadcastGameState }),
    [broadcastGameState],
  );
  const stopTimer = useCallback(() => stopTurnTimer({ tickRef }), []);
  const startTimer = useCallback(() => startTurnTimer(turnTimerDeps()), [turnTimerDeps]);

  const hostDeps = useCallback(
    () => ({
      stateRef,
      roomRef,
      hostSymbolRef,
      hostRematchPendingRef,
      hostPendingSettingsRef,
      pendingGuestStateRef,
      setState,
      commitHostState,
      broadcastGameState,
      stopTimer,
    }),
    [broadcastGameState, commitHostState, stopTimer],
  );
  const applyHostMove = useCallback(
    (index: number, actor: PlayerSymbol) => applyHostMoveMsg(hostDeps(), index, actor),
    [hostDeps],
  );
  const handleHostData = useCallback(
    (message: PeerMessage) => handleHostMessage(hostDeps(), message),
    [hostDeps],
  );

  const relayDeps = useCallback(
    () => ({
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
    }),
    [broadcastGameState, commitHostState, startTimer, stopTimer],
  );
  const handleWsEvent = useCallback(
    (event: { type: string; [k: string]: unknown }) => handleRelayEvent(relayDeps(), event),
    [relayDeps],
  );

  const guestDeps = useCallback(
    () => ({
      stateRef,
      guestSymbolRef,
      pendingGuestStateRef,
      setState,
      stopTimer,
    }),
    [stopTimer],
  );
  const handleGuestData = useCallback(
    (message: PeerMessage) => handleGuestMessage(guestDeps(), message),
    [guestDeps],
  );

  const lifecycleDeps = useCallback(
    () => ({
      roomRef,
      stateRef,
      roleRef,
      hostSymbolRef,
      hostDisplayName: options.hostDisplayName,
      hostColor: options.hostColor,
      hostShape: options.hostShape,
      setState,
      update,
      handleWsEvent,
      handleHostData,
      handleGuestData,
      stopTimer,
    }),
    [handleGuestData, handleHostData, handleWsEvent, options.hostColor, options.hostDisplayName, options.hostShape, stopTimer, update],
  );

  const startAsHost = useCallback(
    (providedRoomId?: string, wsUrl?: string) => startAsHostImpl(lifecycleDeps(), providedRoomId, wsUrl),
    [lifecycleDeps],
  );

  const joinAsGuest = useCallback(
    (roomId: string, wsUrl?: string) => joinAsGuestImpl(lifecycleDeps(), roomId, wsUrl),
    [lifecycleDeps],
  );


  const startQuickMatch = useCallback(async () => {
    await runQuickMatch({
      matchmakingTicketRef,
      hasStartedRef,
      stopTimer,
      setStatus: update,
      patchStatus: setState,
      hostDisplayName: options.hostDisplayName,
      startAsHost,
      joinAsGuest,
    });
  }, [joinAsGuest, options.hostDisplayName, startAsHost, stopTimer, update]);

  const sendMove = useCallback(
    (index: number) => {
      if (state.role === "host") {
        applyHostMove(index, hostSymbolRef.current ?? PlayerSymbol.X);
        return;
      }
      if (state.role === "guest") {
        const guestSymbol = state.guestSymbol;
        const optimistic = guestSymbol
          ? applyAuthorizedMove(stateRef.current, index, guestSymbol)
          : null;
        if (!optimistic) return;

        const sent = roomRef.current?.send({ type: "move", index }) ?? false;
        if (!sent) return;

        // Render the guest's move immediately. The host's gameUpdate remains
        // authoritative and will reconcile this state when it arrives; if the
        // host rejects this move, the rollback path restores the snapshot we
        // save here so the guest does not drift from the relay's truth.
        pendingGuestStateRef.current = stateRef.current;
        stateRef.current = optimistic;
        setState((prev) => ({ ...prev, gameState: optimistic }));
      }
    },
    [applyHostMove, state.guestSymbol, state.role],
  );

  const requestRematch = useCallback(() => {
    if (state.role === "guest") {
      // A guest "rematch" only counts when it follows a host rematch request
      // while the previous game is terminal. Host gating must mirror this.
      if (
        state.status !== "connected" ||
        state.gameState.winner === null ||
        state.gameState.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      roomRef.current?.send({ type: "rematchAccept" });
    } else if (state.role === "host") {
      // Host can only request a rematch when the previous game is over and
      // the guest is still connected. Without the status check the host can
      // strand itself in a pending state after the opponent leaves.
      if (
        state.status !== "connected" ||
        state.gameState.winner === null ||
        state.gameState.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      hostRematchPendingRef.current = true;
      // Use the host's current symbol so the guest UI names the right player.
      const hostSymbol = hostSymbolRef.current ?? PlayerSymbol.X;
      roomRef.current?.send({ type: "rematchRequested", requesterSymbol: hostSymbol });
      setState((prev) => ({
        ...prev,
        message: "Waiting for opponent to accept rematch",
      }));
    }
  }, [state.role, state.gameState.winner, state.gameState.gameStatus, state.status]);

  const declineRematch = useCallback(() => {
    if (state.role === "guest") {
      roomRef.current?.send({ type: "rematchDecline" });
      setState((prev) => ({ ...prev, message: "" }));
    }
  }, [state.role]);

  const cancelRematch = useCallback(() => {
    // Only the host issues rematch requests, so only the host can withdraw
    // one. If no request is pending there is nothing to cancel — bail out
    // without touching the wire or local state so a stray tap is a no-op.
    if (state.role !== "host" || !hostRematchPendingRef.current) return;
    hostRematchPendingRef.current = false;
    roomRef.current?.send({ type: "rematchCancel" });
    setState((prev) => ({ ...prev, message: "" }));
  }, [state.role]);

  const leave = useCallback(() => {
    leaveRoom(roomRef);
    stopTimer();
    abandonTicket({ matchmakingTicketRef }, "on leave");
    hasStartedRef.current = false;
    setState((prev) => ({ ...prev, status: "disconnected", message: "You left" }));
  }, [stopTimer]);

  useEffect(() => {
    if ((state.role === "host" || state.role === "guest") && isGameActive(stateRef.current)) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [
    state.role,
    state.gameState.gameStatus,
    state.gameState.winner,
    state.gameState.turnDeadlineAt,
    startTimer,
    stopTimer,
  ]);

  // Unmount cleanup: if the component tears down while a quick-match is
  // mid-poll, the async `startQuickMatch` loop would otherwise keep polling
  // for up to 2 minutes and only cancel the ticket at the very end. That
  // leaks the ticket on the Worker side for the whole grace window. Nilling
  // the ticket ref here breaks the poll loop immediately, and we fire a
  // best-effort `leaveMatch` so the Worker drops the ticket now. We also
  // close the room socket and stop the timer. No setState on unmount.
  useEffect(() => {
    return () => {
      abandonTicket({ matchmakingTicketRef }, "on unmount");
      hasStartedRef.current = false;
      leaveRoom(roomRef);
      stopTimer();
    };
  }, [stopTimer]);

  const retryReconnect = useCallback(() => {
    roomRef.current?.reconnectNow();
  }, []);

  const updatePendingSettings = useCallback((next: PendingPlayerSettings) => {
    hostPendingSettingsRef.current = next;
  }, []);

  return {
    state,
    startAsHost,
    startQuickMatch,
    joinAsGuest,
    sendMove,
    requestRematch,
    declineRematch,
    cancelRematch,
    retryReconnect,
    leave,
    updatePendingSettings,
  };
}
