import { useCallback, useEffect, useRef, useState } from "react";
import { Color, GameModes, GameStatus, PlayerSymbol, REMATCH_TIMEOUT_MS, SymbolShape, TURN_DURATION_MS } from "@/game/constants";
import { freshGameState, isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { applyAuthorizedMove, toWireGameState } from "@/lib/peer";
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
import {
  applyHostMove as applyHostMoveMsg,
  disarmSyncReplyThrottle,
  acceptIncomingRematch,
  handleHostMessage,
  SYNC_REPLY_COOLDOWN_MS,
} from "./peer-room/hostProtocol";
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
  /**
   * F590: the message a host pause replaced. The pause frame shows
   * "Your host paused the game" so a stopped clock is legible, but a live
   * notice (rematch prompt, error text) is stashed here and restored on
   * resume instead of being destroyed. `null` when nothing is stashed.
   */
  pausedStash: string | null;
  /**
   * True while a host rematch request is pending on the guest. This is
   * the source of truth for rematch-prompt UI — never derive it by
   * matching user-facing message copy with a regex.
   */
  rematchIncoming: boolean;
  /**
   * True while this client (host) has issued a rematch request the guest
   * has not answered yet. Source of truth for the host's cancel UI —
   * mirrors rematchPendingRef as renderable state.
   */
  rematchOutgoing: boolean;
  /**
   * 1-based position in the matchmaking FIFO queue while a quick-match
   * ticket is queued (reported by the Worker on join/poll). `null` when
   * not searching or when the service doesn't report positions.
   */
  queuePosition: number | null;
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
  pausedStash: null,
  rematchIncoming: false,
  rematchOutgoing: false,
  queuePosition: null,
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
  const rematchPendingRef = useRef(false);
  // Throttle for sync_request replies (hostProtocol): the timestamp of
  // the last state_snapshot send bounds burst pulls to one per window.
  // Seeded one full window in the past so the first pull is answered.
  const lastSyncReplyAtRef = useRef(-SYNC_REPLY_COOLDOWN_MS);
  // True once a peer join was processed in this room — sync_request is
  // gated on this so a never-joined peer cannot pull state snapshots.
  const guestJoinedRef = useRef(false);
  // Host-side rematch deadline (fleet 09-13): a pending request expires
  // after REMATCH_TIMEOUT_MS so the host never waits forever on a guest
  // who walked away mid-prompt. On expiry the host sends rematchCancel —
  // the guest's existing handler clears its prompt.
  const rematchTimeoutRef = useRef<number | null>(null);
  // Host remembers player settings (name/color/shape) the user edited from
  // the in-game edit button. Those changes only apply on the next rematch so
  // the live game is never mutated while it's in progress.
  const hostPendingSettingsRef = useRef<PendingPlayerSettings | null>(null);
  // Guest remembers the authoritative state right before applying an
  // optimistic move. If the host rejects the move via `{type:"error", message:"Invalid move"}`,
  // we roll back so the UI does not drift from the relay's source of truth.
  const pendingGuestStateRef = useRef<GameState | null>(null);
  // Reconnect-grace bookkeeping (fleet 09-07 finding 2): the move the
  // last full timer reset was granted for.
  const reconnectResetsRef = useRef({ moveCount: -1 });
  // Overlay pause (fleet 09-22: host's mid-game Settings/Help overlays did
  // not pause the 10s turn timer while local play pauses via setPaused).
  // While paused the interval is stopped and the deadline is frozen; on
  // resume the deadline is rebuilt from the frozen remaining time so the
  // paused span never counts down the turn.
  const pausedRef = useRef(false);
  const [paused, setPausedState] = useState(false);
  // True when the HOST has frozen the clock (online only). Distinct from
  // `paused`, which is this client's own overlay — a guest must reflect the
  // host's pause without conflating it with its own.
  const [hostPaused, setHostPausedState] = useState(false);

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
    roomRef.current?.send({ type: "gameUpdate", gameState: toWireGameState(gameState) });
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

  const setPaused = useCallback(
    (target: boolean) => {
      // Repeat calls with the same target must not re-freeze: a second
      // pause would recompute turnTimeRemaining off the already-stale
      // deadline and drain it while paused (same guard as useLocalGame).
      if (pausedRef.current === target) return;
      pausedRef.current = target;
      setPausedState(target);
      // Tell the guest the clock stopped / started. Host-authoritative: a
      // guest never acts on its own pause here. Without this frame the guest
      // keeps counting down against a frozen host clock (draining to 0), and
      // any move it sends is refused — its optimistic mark vanishing with no
      // explanation is the most confusing thing this protocol can do to a
      // player. Sent before the isGameActive bail so the guest is never left
      // believing the game is live when the host has already frozen it.
      if (roleRef.current === "host") {
        roomRef.current?.send({ type: "pause", paused: target });
      }
      const current = stateRef.current;
      if (!isGameActive(current)) return;
      if (target) {
        // Freeze the exact remaining time; the resume branch rebuilds
        // the deadline from it. Stop the interval now so no tick can
        // fire before the active-game effect below re-runs off `paused`.
        stopTimer();
        if (current.turnDeadlineAt === undefined) return;
        const frozen: GameState = {
          ...current,
          turnTimeRemaining: Math.max(0, current.turnDeadlineAt - Date.now()),
        };
        stateRef.current = frozen;
        setState((prev) => ({ ...prev, gameState: frozen }));
        return;
      }
      // Rebuild the absolute deadline from the frozen remaining time so
      // time spent paused doesn't count down the turn. Host-only: the
      // host owns the authoritative clock and broadcasts the rebuilt
      // state. A guest resume must NOT rebuild — the guest's deadline
      // stayed truthful while its display froze (the host clock kept
      // draining), so Date.now()+frozen would overstate remaining by the
      // pause duration (F226). Unpausing leaves the real deadline; the
      // host's next broadcast corrects any drift.
      if (roleRef.current !== "host") return;
      if (current.turnDeadlineAt === undefined) return;
      const rebuilt: GameState = {
        ...current,
        turnDeadlineAt: Date.now() + (current.turnTimeRemaining ?? TURN_DURATION_MS),
      };
      stateRef.current = rebuilt;
      setState((prev) => ({ ...prev, gameState: rebuilt }));
      broadcastGameState(rebuilt);
    },
    [broadcastGameState, stopTimer],
  );

  const hostPausedRef = useRef(false);
  /** Guest-side response to the host's `pause` frame.
   *
   *  Deliberately does NOT rebuild the deadline, unlike the local
   *  setPaused resume branch: the guest's deadline stayed truthful while the
   *  host's clock was stopped, so `Date.now() + frozen` would overstate the
   *  remaining time by the entire pause duration (F226). The host's resume
   *  frame and its next gameUpdate reconcile the real clock. Here we only
   *  stop the countdown draining and mirror the flag so the board disables
   *  for the same reason it does locally. */
  const applyHostPause = useCallback(
    (paused: boolean) => {
      if (hostPausedRef.current === paused) return;
      hostPausedRef.current = paused;
      setHostPausedState(paused);
      if (paused) {
        stopTimer();
        const current = stateRef.current;
        if (!isGameActive(current) || current.turnDeadlineAt === undefined) return;
        setState((prev) => ({
          ...prev,
          gameState: {
            ...prev.gameState,
            turnTimeRemaining: Math.max(
              0,
              (prev.gameState.turnDeadlineAt ?? 0) - Date.now(),
            ),
          },
        }));
      }
      // Unpausing: the active-game effect re-runs off hostPaused and
      // restarts the interval against the untouched deadline.
    },
    [stopTimer],
  );

  const clearRematchTimeout = useCallback(() => {
    if (rematchTimeoutRef.current !== null) {
      window.clearTimeout(rematchTimeoutRef.current);
      rematchTimeoutRef.current = null;
    }
  }, []);
  const expireRematch = useCallback(() => {
    rematchTimeoutRef.current = null;
    if (!rematchPendingRef.current) return;
    rematchPendingRef.current = false;
    roomRef.current?.send({ type: "rematchCancel" });
    setState((prev) => ({ ...prev, message: "Rematch request expired", rematchOutgoing: false }));
  }, []);

  const hostDeps = useCallback(
    () => ({
      stateRef,
      roomRef,
      hostSymbolRef,
      rematchPendingRef,
      lastSyncReplyAtRef,
      guestJoinedRef,
      reconnectResetsRef,
      hostPendingSettingsRef,
      pendingGuestStateRef,
      pausedRef,
      setState,
      commitHostState,
      broadcastGameState,
      stopTimer,
      clearRematchTimeout,
    }),
    [broadcastGameState, commitHostState, stopTimer, clearRematchTimeout],
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
      roomRef,
      stateRef,
      roleRef,
      hostSymbolRef,
      guestSymbolRef,
      rematchPendingRef,
      reconnectResetsRef,
      pausedRef,
      setState,
      commitHostState,
      broadcastGameState,
      // A dropped pull (send → false while the socket is down) needs no
      // retry — the join resync and the host's next gameUpdate still
      // reconcile the guest, so the boolean is deliberately not read.
      requestSync: () => {
        roomRef.current?.send({ type: "sync_request" });
      },
      startTimer,
      stopTimer,
      clearRematchTimeout,
    }),
    [broadcastGameState, commitHostState, startTimer, stopTimer, clearRematchTimeout],
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
      rematchPendingRef,
      clearRematchTimeout,
      onHostPause: applyHostPause,
      setState,
      stopTimer,
    }),
    [stopTimer, clearRematchTimeout, applyHostPause],
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
      guestSymbolRef,
      hostDisplayName: options.hostDisplayName,
      hostColor: options.hostColor,
      hostShape: options.hostShape,
      setState,
      update,
      handleWsEvent,
      handleHostData,
      handleGuestData,
      stopTimer,
      rematchPendingRef,
      lastSyncReplyAtRef,
      guestJoinedRef,
      hostPendingSettingsRef,
      reconnectResetsRef,
      pendingGuestStateRef,
    }),
    [handleGuestData, handleHostData, handleWsEvent, options.hostColor, options.hostDisplayName, options.hostShape, stopTimer, update],
  );

  const startAsHost = useCallback(
    (providedRoomId?: string, wsUrl?: string) => startAsHostImpl(lifecycleDeps(), providedRoomId, wsUrl),
    [lifecycleDeps],
  );

  const joinAsGuest = useCallback(
    (roomId: string, wsUrl?: string, slotToken?: string) =>
      joinAsGuestImpl(lifecycleDeps(), roomId, wsUrl, slotToken),
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
      setRoomSlotToken: (token) => roomRef.current?.setSlotToken(token),
    });
  }, [joinAsGuest, options.hostDisplayName, startAsHost, stopTimer, update]);

  const sendMove = useCallback(
    (index: number) => {
      // Paused = game frozen (mid-game overlays); no move may commit on
      // either side while the clock can't drain (F225).
      if (pausedRef.current) return;
      if (state.role === "host") {
        // F249: no move may commit while the socket is down — commitHostState
        // writes locally and broadcastGameState's send() returns false
        // silently, so a reconnect-window click would diverge the boards
        // (same gate the timer effect and the guest's sent-check use).
        if (state.status !== "connected") return;
        // hostSymbolRef is the single source of truth: it is assigned
        // synchronously in startAsHost and never cleared, so state.hostSymbol
        // can only ever lag it, never lead it (F161 — a `?? state.hostSymbol`
        // fallback was a second null policy for the same concept). Null means
        // the room was never initialized — never guess X and apply a move
        // for the wrong side. No-op instead.
        const hostSymbol = hostSymbolRef.current;
        if (hostSymbol === null) return;
        applyHostMove(index, hostSymbol);
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
        // Keep the FIRST optimistic snapshot: a rapid double-sendMove
        // would otherwise overwrite S0 with S1 (which already contains
        // move 1), so a host rejection of move 1 could not roll back
        // (fleet 09-07 P3).
        if (pendingGuestStateRef.current === null) {
          pendingGuestStateRef.current = stateRef.current;
        }
        stateRef.current = optimistic;
        setState((prev) => ({ ...prev, gameState: optimistic }));
      }
    },
    [applyHostMove, state.guestSymbol, state.role, state.status],
  );

  const requestRematch = useCallback(() => {
    // Either side may ask for another game — it is the same wire message
    // with the asker's own symbol, so the receiver can name them. This
    // requires the previous game to be over and the opponent still
    // connected: without the status check the asker can strand itself in
    // a pending state after the opponent leaves.
    if (
      state.status !== "connected" ||
      state.gameState.winner === null ||
      state.gameState.gameStatus !== GameStatus.COMPLETED
    ) {
      return;
    }
    if (rematchPendingRef.current) return;
    // Only one request may be in flight, and only one prompt may be up:
    // answering someone else's request and asking at the same time would
    // leave both sides waiting on each other.
    if (state.rematchIncoming) return;
    const ownSymbol = state.role === "host" ? hostSymbolRef.current : guestSymbolRef.current;
    if (ownSymbol === null) return;
    rematchPendingRef.current = true;
    roomRef.current?.send({ type: "rematchRequested", requesterSymbol: ownSymbol });
    clearRematchTimeout();
    rematchTimeoutRef.current = window.setTimeout(expireRematch, REMATCH_TIMEOUT_MS);
    setState((prev) => ({
      ...prev,
      message: "Waiting for opponent to accept rematch",
      rematchOutgoing: true,
    }));
  }, [
    state.role,
    state.status,
    state.gameState.winner,
    state.gameState.gameStatus,
    state.rematchIncoming,
    clearRematchTimeout,
    expireRematch,
  ]);

  const acceptRematch = useCallback(() => {
    // The host owns the room, so accepting a guest's request is a local
    // reset that the reset path already announces to the room. A guest
    // asks the host to do it.
    if (state.status !== "connected" || !state.rematchIncoming) return;
    if (
      state.gameState.winner === null ||
      state.gameState.gameStatus !== GameStatus.COMPLETED
    ) {
      return;
    }
    if (state.role === "host") {
      acceptIncomingRematch(hostDeps());
      return;
    }
    roomRef.current?.send({ type: "rematchAccept" });
    setState((prev) => ({ ...prev, message: "", rematchIncoming: false }));
  }, [
    state.role,
    state.status,
    state.rematchIncoming,
    state.gameState.winner,
    state.gameState.gameStatus,
    hostDeps,
  ]);

  const declineRematch = useCallback(() => {
    // Either side may turn the other down; declining only clears the
    // prompt the asker raised.
    if (!state.rematchIncoming) return;
    roomRef.current?.send({ type: "rematchDecline" });
    setState((prev) => ({ ...prev, message: "", rematchIncoming: false }));
  }, [state.rematchIncoming]);

  const cancelRematch = useCallback(() => {
    // Whoever asked may withdraw the ask. If no request of ours is
    // pending there is nothing to cancel — bail out without touching the
    // wire or local state so a stray tap is a no-op.
    if (!rematchPendingRef.current) return;
    rematchPendingRef.current = false;
    clearRematchTimeout();
    roomRef.current?.send({ type: "rematchCancel" });
    setState((prev) => ({ ...prev, message: "", rematchOutgoing: false }));
  }, [clearRematchTimeout]);

  const leave = useCallback(() => {
    leaveRoom(roomRef);
    stopTimer();
    pausedRef.current = false;
    setPausedState(false);
    hostPausedRef.current = false;
    setHostPausedState(false);
    abandonTicket({ matchmakingTicketRef }, "on leave");
    hasStartedRef.current = false;
    rematchPendingRef.current = false;
    // Room-scoped sync state dies with the room — a fresh room must not
    // inherit the joined flag or a still-running reply cooldown.
    guestJoinedRef.current = false;
    disarmSyncReplyThrottle(lastSyncReplyAtRef);
    // F241: pending identity edits are room-scoped — never let them leak
    // into the next room's rematch.
    hostPendingSettingsRef.current = null;
    clearRematchTimeout();
    setState((prev) => ({ ...prev, status: "disconnected", message: "You left", rematchIncoming: false, rematchOutgoing: false, queuePosition: null }));
  }, [stopTimer, clearRematchTimeout]);

  useEffect(() => {
    // state.status gates the timer: while "reconnecting" the socket is down
    // and a forced-move broadcast is silently dropped (RoomClient.send →
    // false), applying a move locally the peer never sees — permanent
    // host/guest divergence (fleet needs-work 2026-09-07 P1 + 09-08 P2).
    if (
      (state.role === "host" || state.role === "guest") &&
      state.status === "connected" &&
      !paused &&
      !hostPaused &&
      isGameActive(stateRef.current)
    ) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [
    state.role,
    state.status,
    paused,
    hostPaused,
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
      // F257: an armed 30s rematch timeout must not survive unmount — it
      // would fire send() on a closed room and setState on a dead tree.
      rematchPendingRef.current = false;
      clearRematchTimeout();
      leaveRoom(roomRef);
      stopTimer();
    };
  }, [stopTimer, clearRematchTimeout]);

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
    acceptRematch,
    declineRematch,
    cancelRematch,
    retryReconnect,
    leave,
    updatePendingSettings,
    setPaused,
    paused,
    // True while the HOST has frozen the clock — a guest needs this to
    // disable its board and stop its countdown for the same reason a local
    // pause does. A host never sets this.
    hostPaused,
  };
}
