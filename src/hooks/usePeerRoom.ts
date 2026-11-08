import { freezeRemaining, rebuildDeadline } from "@/game/turnClock";
import type { Reaction } from "@/lib/social";
import { useCallback, useEffect, useRef, useState } from "react";
import { Color, GameModes, GameStatus, PlayerSymbol, REMATCH_TIMEOUT_MS, SymbolShape, type PlayerSettings } from "@/game/constants";
import { freshGameState, isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { toWireGameState } from "@/lib/peer.wire";
import { applyAuthorizedMove } from "@/lib/peer.apply";
import type { PeerMessage } from "@/lib/peer.wire";
import { RoomClient } from "@/lib/roomClient";
import { t } from "@/i18n/language";
import {
  startTurnTimer,
  stopTurnTimer,
} from "@/lib/room-protocol/turnTimer";
import { handleRelayEvent } from "@/lib/room-protocol/relayEvents";
import { abandonTicket, runQuickMatch } from "@/lib/room-protocol/matchmaking";
import {
  joinAsGuest as joinAsGuestImpl,
  leaveRoom,
  startAsHost as startAsHostImpl,
} from "@/lib/room-protocol/roomLifecycle";
import {
  applyHostMove as applyHostMoveMsg,
  disarmSyncReplyThrottle,
  acceptIncomingRematch,
  handleHostMessage,
  SYNC_REPLY_COOLDOWN_MS,
} from "@/lib/room-protocol/hostProtocol";
import { handleGuestMessage } from "@/lib/room-protocol/guestProtocol";

/**
 * Online play hook for tic-tac-toe.
 *
 * Transport: Cloudflare Durable Object WebSocket relay inside the shared
 * `fuurma-matchmaking` Worker. The hook preserves the same public API so the
 * consuming surface (`OnlineGameSurface`) doesn't need to branch.
 *
 * Spec: hub/migrations/2026-07-games-do-websocket-migration.md
 */

export type { PeerRole, PeerRoomState, PeerStatus, QueueStage } from "@/lib/room-protocol/state";
import type { PeerRole, PeerRoomState, PeerStatus } from "@/lib/room-protocol/state";

/**
 * Pending host-side settings that the user changed via the in-game edit
 * button. Stored on the host only; the guest cannot edit a peer's identity.
 */
/**
 * Re-exported for the room-protocol's callers. The declaration lives in
 * game/constants.ts as `PlayerSettings` — this file carried a byte-identical
 * copy under this name, and the settings sheet a third.
 */
export type PendingPlayerSettings = PlayerSettings;

const initialState: PeerRoomState = {
  role: null,
  status: "idle",
  queue: "none",
  roomId: "",
  hostSymbol: null,
  guestSymbol: null,
  message: "",
  pausedStash: null,
  rematchIncoming: false,
  rematchOutgoing: false,
  leftBySelf: false,
  gameState: freshGameState(),
};

interface PeerRoomOptions {
  hostDisplayName: string;
  hostColor: Color;
  hostShape?: SymbolShape;
  gameMode: typeof GameModes.ONLINE;
}

export const SOCIAL_COOLDOWN_MS = 3000;

/**
 * Checks whether a social reaction can be sent under connection and cooldown constraints.
 */
export function canSendReaction(
  status: PeerStatus,
  lastSentAt: number,
  now = Date.now(),
): boolean {
  return status === "connected" && now - lastSentAt >= SOCIAL_COOLDOWN_MS;
}

/**
 * Checks whether an incoming message is a valid social reaction within the cooldown window.
 */
export function shouldAcceptReaction(
  message: PeerMessage,
  lastReceivedAt: number,
  now = Date.now(),
): message is { type: "social_reaction"; id: Reaction } {
  return message.type === "social_reaction" && now - lastReceivedAt >= SOCIAL_COOLDOWN_MS;
}

/**
 * Freezes the remaining turn time on a game state when pausing.
 * Returns a new GameState with turnTimeRemaining calculated, or the unchanged state if no deadline exists.
 */
export function freezeGameState(current: GameState, now = Date.now()): GameState {
  if (current.turnDeadlineAt === undefined) return current;
  return {
    ...current,
    turnTimeRemaining: freezeRemaining(current.turnDeadlineAt, now),
  };
}

/**
 * Rebuilds the turn deadline from the frozen remaining turn time when resuming.
 * Host-only: returns a new GameState with turnDeadlineAt restored, or the unchanged state if no deadline existed.
 */
export function rebuildDeadlineGameState(current: GameState, now = Date.now()): GameState {
  if (current.turnDeadlineAt === undefined) return current;
  return {
    ...current,
    turnDeadlineAt: rebuildDeadline(current.turnTimeRemaining, now),
  };
}

/**
 * Guards whether a host move can be dispatched: socket must be connected and
 * host symbol assigned.
 */
export function canSendHostMove(
  status: PeerStatus,
  hostSymbol: PlayerSymbol | null,
): hostSymbol is PlayerSymbol {
  return status === "connected" && hostSymbol !== null;
}

export interface GuestMoveDeps {
  roomRef: { current: RoomClient | null };
  stateRef: { current: GameState };
  pendingGuestStateRef: { current: GameState | null };
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
}

/**
 * Dispatches an optimistic guest move and records the rollback snapshot.
 * Returns true if the move was valid and sent over the WebSocket.
 */
export function dispatchGuestMove(
  deps: GuestMoveDeps,
  index: number,
  guestSymbol: PlayerSymbol | null,
): boolean {
  if (!guestSymbol) return false;
  const optimistic = applyAuthorizedMove(deps.stateRef.current, index, guestSymbol);
  if (!optimistic) return false;

  const sent = deps.roomRef.current?.send({ type: "move", index }) ?? false;
  if (!sent) return false;

  if (deps.pendingGuestStateRef.current === null) {
    deps.pendingGuestStateRef.current = deps.stateRef.current;
  }
  deps.stateRef.current = optimistic;
  deps.setState((prev) => ({ ...prev, gameState: optimistic }));
  return true;
}

/**
 * Checks whether the current game is over with a winner, eligible for rematch.
 */
export function isRematchEligibleGame(gameState: GameState): boolean {
  return gameState.winner !== null && gameState.gameStatus === GameStatus.COMPLETED;
}

/**
 * Checks whether a client is eligible to request a rematch.
 */
export function canRequestRematch(
  status: PeerStatus,
  gameState: GameState,
  isRematchPending: boolean,
  isRematchIncoming: boolean,
  ownSymbol: PlayerSymbol | null,
): ownSymbol is PlayerSymbol {
  return (
    status === "connected" &&
    isRematchEligibleGame(gameState) &&
    !isRematchPending &&
    !isRematchIncoming &&
    ownSymbol !== null
  );
}

/**
 * Checks whether an incoming rematch request can be accepted.
 */
export function canAcceptRematch(
  status: PeerStatus,
  gameState: GameState,
  isRematchIncoming: boolean,
): boolean {
  return status === "connected" && isRematchIncoming && isRematchEligibleGame(gameState);
}

/**
 * Clears an active timer ref and resets it to null.
 */
export function clearTimerRef(
  ref: { current: ReturnType<typeof setTimeout> | number | null },
): void {
  if (ref.current !== null) {
    clearTimeout(ref.current);
    ref.current = null;
  }
}

/**
 * Clears the waiting-for-host timer and nulls its deadline timestamp.
 */
export function clearWaitingForHost(
  timeoutRef: { current: ReturnType<typeof setTimeout> | null },
  deadlineRef: { current: number | null },
): void {
  clearTimerRef(timeoutRef);
  deadlineRef.current = null;
}

export interface ResetRoomScopedRefsDeps {
  guestJoinedRef: { current: boolean };
  lastSyncReplyAtRef: { current: number };
  hostPendingSettingsRef: { current: PendingPlayerSettings | null };
  reconnectResetsRef: { current: { moveCount: number } };
  pendingGuestStateRef: { current: GameState | null };
  syncPendingRef: { current: boolean };
}

/**
 * Resets protocol state refs that belong to a single room session.
 */
export function resetRoomScopedRefs(deps: ResetRoomScopedRefsDeps): void {
  deps.guestJoinedRef.current = false;
  disarmSyncReplyThrottle(deps.lastSyncReplyAtRef);
  deps.hostPendingSettingsRef.current = null;
  deps.reconnectResetsRef.current.moveCount = -1;
  deps.pendingGuestStateRef.current = null;
  deps.syncPendingRef.current = false;
}

export interface RoomTeardownDeps {
  roomRef: { current: RoomClient | null };
  matchmakingTicketRef: { current: string | null };
  hasStartedRef: { current: boolean };
  rematchPendingRef: { current: boolean };
  quickMatchHostRef: { current: boolean };
  rematchTimeoutRef: { current: ReturnType<typeof setTimeout> | number | null };
  waitingForHostTimeoutRef: { current: ReturnType<typeof setTimeout> | null };
  waitingForHostDeadlineAtRef: { current: number | null };
  stopTimer: () => void;
}

/**
 * Cleans up room connections, timers, tickets and matchmaking state.
 * Shared between explicit leave and unmount teardown.
 */
export function teardownActiveRoom(deps: RoomTeardownDeps, reason: string): void {
  abandonTicket({ matchmakingTicketRef: deps.matchmakingTicketRef }, reason);
  deps.hasStartedRef.current = false;
  deps.rematchPendingRef.current = false;
  deps.quickMatchHostRef.current = false;
  clearTimerRef(deps.rematchTimeoutRef);
  clearWaitingForHost(deps.waitingForHostTimeoutRef, deps.waitingForHostDeadlineAtRef);
  leaveRoom(deps.roomRef);
  deps.stopTimer();
}

/**
 * Predicate determining whether the turn countdown timer should run.
 */
export function shouldRunTurnTimer(
  role: PeerRole,
  status: PeerStatus,
  paused: boolean,
  hostPaused: boolean,
  gameState: GameState,
): boolean {
  return (
    (role === "host" || role === "guest") &&
    status === "connected" &&
    !paused &&
    !hostPaused &&
    isGameActive(gameState)
  );
}

export function usePeerRoom(options: PeerRoomOptions) {
  const [state, setState] = useState<PeerRoomState>(initialState);
  const roomRef = useRef<RoomClient | null>(null);
  const [reaction, setReaction] = useState<{ id: Reaction; at: number } | null>(null);
  const lastReactionRef = useRef(0);
  const lastSentReactionRef = useRef(0);
  const handleSocial = useCallback((message: PeerMessage) => {
    const now = Date.now();
    if (shouldAcceptReaction(message, lastReactionRef.current, now)) {
      lastReactionRef.current = now;
      setReaction({ id: message.id, at: now });
    }
  }, []);
  const sendReaction = useCallback((id: Reaction) => {
    const now = Date.now();
    if (!canSendReaction(state.status, lastSentReactionRef.current, now)) return false;
    const sent = roomRef.current?.send({ type: "social_reaction", id }) ?? false;
    if (sent) lastSentReactionRef.current = now;
    return sent;
  }, [state.status]);
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
  // Guest-side F618 gate: armed only when a sync_request actually left the
  // socket, so guestProtocol applies just the snapshot it asked for.
  const syncPendingRef = useRef(false);
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
  // F712/F726: quick-match peers need a bound while the allocated counterpart
  // has not seated. Create rooms do not; the host must keep its invite code
  // alive. Room-scoped like the rest: cleared on room entry, leave, unmount.
  const waitingForHostTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // F712: the absolute epoch-ms behind that timer — the first opponent-less
  // welcome fixes it, so a reconnect's fresh welcome cannot slide the bound
  // forward by another full timeout per flap.
  const waitingForHostDeadlineAtRef = useRef<number | null>(null);
  // F738: only quick-match hosts have a bounded wait for an absent guest;
  // Create hosts keep their room code live until the invited guest arrives.
  const quickMatchHostRef = useRef(false);
  // Host remembers player settings (name/color/shape) the user edited from
  // the in-game edit button. Those changes only apply on the next rematch so
  // the live game is never mutated while it's in progress.
  const hostPendingSettingsRef = useRef<PendingPlayerSettings | null>(null);
  // Guest remembers the authoritative state right before applying an
  // optimistic move. If the host's authoritative update does not count the
  // move, we roll back so the UI does not drift from the host's state.
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

  // Turn clock + host/guest protocols live in room-protocol modules
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
        const frozen = freezeGameState(current);
        if (frozen !== current) {
          stateRef.current = frozen;
          setState((prev) => ({ ...prev, gameState: frozen }));
        }
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
      const rebuilt = rebuildDeadlineGameState(current);
      if (rebuilt !== current) {
        stateRef.current = rebuilt;
        setState((prev) => ({ ...prev, gameState: rebuilt }));
        broadcastGameState(rebuilt);
      }
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
        if (!isGameActive(current)) return;
        const frozen = freezeGameState(current);
        if (frozen !== current) {
          setState((prev) => ({ ...prev, gameState: frozen }));
        }
      }
      // Unpausing: the active-game effect re-runs off hostPaused and
      // restarts the interval against the untouched deadline.
    },
    [stopTimer],
  );

  const clearRematchTimeout = useCallback(() => {
    clearTimerRef(rematchTimeoutRef);
  }, []);

  const expireRematch = useCallback(() => {
    rematchTimeoutRef.current = null;
    if (!rematchPendingRef.current) return;
    rematchPendingRef.current = false;
    roomRef.current?.send({ type: "rematchCancel" });
    setState((prev) => ({ ...prev, message: t("peer.rematchExpired"), rematchOutgoing: false }));
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
      quickMatchHostRef,
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
      // reconcile the guest. The flag is armed only on a real send, so a
      // snapshot that answers nothing we sent stays ignored (F618).
      requestSync: () => {
        if (roomRef.current?.send({ type: "sync_request" })) {
          syncPendingRef.current = true;
        }
      },
      startTimer,
      stopTimer,
      clearRematchTimeout,
      waitingForHostTimeoutRef,
      waitingForHostDeadlineAtRef,
    }),
    [broadcastGameState, commitHostState, startTimer, stopTimer, clearRematchTimeout],
  );
  const handleWsEvent = useCallback(
    (event: { type: string; [k: string]: unknown }) => {
      if (event.type === "peer-left") setReaction(null);
      handleRelayEvent(relayDeps(), event);
    },
    [relayDeps],
  );

  const guestDeps = useCallback(
    () => ({
      stateRef,
      guestSymbolRef,
      pendingGuestStateRef,
      rematchPendingRef,
      syncPendingRef,
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
      handleSocial,
      stopTimer,
      rematchPendingRef,
      lastSyncReplyAtRef,
      guestJoinedRef,
      hostPendingSettingsRef,
      reconnectResetsRef,
      pendingGuestStateRef,
      syncPendingRef,
      waitingForHostTimeoutRef,
      waitingForHostDeadlineAtRef,
      quickMatchHostRef,
    }),
    [handleGuestData, handleHostData, handleSocial, handleWsEvent, options.hostColor, options.hostDisplayName, options.hostShape, stopTimer, update],
  );

  const startAsHost = useCallback(
    (providedRoomId?: string, wsUrl?: string, slotToken?: string) =>
      startAsHostImpl(lifecycleDeps(), providedRoomId, wsUrl, slotToken),
    [lifecycleDeps],
  );

  const joinAsGuest = useCallback(
    (roomId: string, wsUrl?: string, slotToken?: string) =>
      joinAsGuestImpl(lifecycleDeps(), roomId, wsUrl, slotToken),
    [lifecycleDeps],
  );


  // F738 follow-up: the absent-peer deadline's mode flag comes from the
  // matchmaking caller, not from slotToken presence — a token-less matched
  // response must not silently disarm the quick-match host's deadline.
  const markQuickMatchHost = useCallback(() => {
    quickMatchHostRef.current = true;
  }, []);

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
      markQuickMatchHost,
    });
  }, [joinAsGuest, markQuickMatchHost, options.hostDisplayName, startAsHost, stopTimer, update]);

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
        // hostSymbolRef is the single source of truth: it is assigned
        // synchronously in startAsHost and never cleared, so state.hostSymbol
        // can only ever lag it, never lead it (F161 — a `?? state.hostSymbol`
        // fallback was a second null policy for the same concept). Null means
        // the room was never initialized — never guess X and apply a move
        // for the wrong side. No-op instead.
        const hostSymbol = hostSymbolRef.current;
        if (!canSendHostMove(state.status, hostSymbol)) return;
        applyHostMove(index, hostSymbol);
        return;
      }
      if (state.role === "guest") {
        dispatchGuestMove(
          { roomRef, stateRef, pendingGuestStateRef, setState },
          index,
          state.guestSymbol,
        );
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
    const ownSymbol = state.role === "host" ? hostSymbolRef.current : guestSymbolRef.current;
    if (
      !canRequestRematch(
        state.status,
        state.gameState,
        rematchPendingRef.current,
        state.rematchIncoming,
        ownSymbol,
      )
    ) {
      return;
    }
    // Only one request may be in flight, and only one prompt may be up:
    // answering someone else's request and asking at the same time would
    // leave both sides waiting on each other.
    rematchPendingRef.current = true;
    roomRef.current?.send({ type: "rematchRequested", requesterSymbol: ownSymbol });
    clearRematchTimeout();
    rematchTimeoutRef.current = window.setTimeout(expireRematch, REMATCH_TIMEOUT_MS);
    setState((prev) => ({
      ...prev,
      message: t("peer.waitingAccept"),
      rematchOutgoing: true,
    }));
  }, [
    state.role,
    state.status,
    state.gameState,
    state.rematchIncoming,
    clearRematchTimeout,
    expireRematch,
  ]);

  const acceptRematch = useCallback(() => {
    // The host owns the room, so accepting a guest's request is a local
    // reset that the reset path already announces to the room. A guest
    // asks the host to do it.
    if (!canAcceptRematch(state.status, state.gameState, state.rematchIncoming)) return;
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
    state.gameState,
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

  const teardownDeps = useCallback(
    (): RoomTeardownDeps => ({
      roomRef,
      matchmakingTicketRef,
      hasStartedRef,
      rematchPendingRef,
      quickMatchHostRef,
      rematchTimeoutRef,
      waitingForHostTimeoutRef,
      waitingForHostDeadlineAtRef,
      stopTimer,
    }),
    [stopTimer],
  );

  const leave = useCallback(() => {
    setReaction(null);
    teardownActiveRoom(teardownDeps(), "on leave");
    pausedRef.current = false;
    setPausedState(false);
    hostPausedRef.current = false;
    setHostPausedState(false);
    // Room-scoped sync state dies with the room — a fresh room must not
    // inherit the joined flag or a still-running reply cooldown.
    // F241: pending identity edits are room-scoped — never let them leak
    // into the next room's rematch.
    // The remaining room-scoped values, matching what room ENTRY clears in
    // roomLifecycle (startAsHost / joinAsGuest). Leaving without these let the
    // next room inherit a reconnect move-count from the last one — which
    // suppresses the full-deadline reset a reconnect should get — plus a
    // rollback snapshot and a sync flag that belong to a room that is gone.
    resetRoomScopedRefs({
      guestJoinedRef,
      lastSyncReplyAtRef,
      hostPendingSettingsRef,
      reconnectResetsRef,
      pendingGuestStateRef,
      syncPendingRef,
    });
    setState((prev) => ({
      ...prev,
      status: "disconnected",
      queue: "none",
      message: t("peer.youLeft"),
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: true,
    }));
  }, [teardownDeps]);

  useEffect(() => {
    // state.status gates the timer: while "reconnecting" the socket is down
    // and a forced-move broadcast is silently dropped (RoomClient.send →
    // false), applying a move locally the peer never sees — permanent
    // host/guest divergence (fleet needs-work 2026-09-07 P1 + 09-08 P2).
    if (shouldRunTurnTimer(state.role, state.status, paused, hostPaused, stateRef.current)) {
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
  // F257: an armed 30s rematch timeout must not survive unmount — it
  // would fire send() on a closed room and setState on a dead tree.
  // F712: an armed host-absent deadline must not fire on a dead tree.
  useEffect(() => {
    return () => {
      teardownActiveRoom(teardownDeps(), "on unmount");
    };
  }, [teardownDeps]);

  const retryReconnect = useCallback(() => {
    roomRef.current?.reconnectNow();
  }, []);

  const updatePendingSettings = useCallback((next: PendingPlayerSettings) => {
    hostPendingSettingsRef.current = next;
  }, []);

  return {
    state,
    reaction, sendReaction,
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
