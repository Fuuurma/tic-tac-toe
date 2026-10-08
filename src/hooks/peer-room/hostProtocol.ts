import {
  GameStatus,
  GameModes,
  PlayerSymbol,
  oppositeSymbol,
  randomPlayerSymbol,
} from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { sanitizeDisplayName } from "@/lib/identity";
import { applyAuthorizedMove, applyForfeitIfActive, applyHostGuestJoin, toWireGameState } from "@/lib/peer";
import type { PeerMessage } from "@/lib/peer";
import type { RoomClient } from "@/lib/room";
import type { PeerRoomState, PendingPlayerSettings } from "../usePeerRoom";

/**
 * Host-side game protocol, extracted from usePeerRoom (god-hook
 * decomposition, slice 2).
 *
 * The host is the game's authority: it validates every guest move
 * (`applyAuthorizedMove`), assigns symbols, gates rematch acceptance
 * behind a pending host request + terminal game, and wins by forfeit
 * when the guest leaves. Messages the host receives arrive via
 * `handleHostData` (routed by role in buildRoomClient).
 */

/** Minimum interval between state_snapshot replies to sync_request. A
 *  genuine reconnect produces at most one pull per relay event, so
 *  replies faster than this are a peer farming full GameState dumps —
 *  answer the first, drop the rest of the burst (review 2026-10-03
 *  repair P2). Cooldown rather than once-per-reconnect so a flapping
 *  socket stays bounded too. */
export const SYNC_REPLY_COOLDOWN_MS = 1_000;

/** Disarm the sync-reply throttle — the next pull is treated as one full
 *  window after the last reply. A new game (room entry, join, rematch)
 *  must not inherit the previous game's cooldown or a legitimate
 *  catch-up pull inside that window is silently dropped (review
 *  2026-10-03 repair P2). */
export const disarmSyncReplyThrottle = (ref: { current: number }) => {
  ref.current = performance.now() - SYNC_REPLY_COOLDOWN_MS;
};

export interface HostProtocolDeps {
  stateRef: { current: GameState };
  roomRef: { current: RoomClient | null };
  hostSymbolRef: { current: PlayerSymbol | null };
  rematchPendingRef: { current: boolean };
  /** Timestamp (performance.now) of the last state_snapshot reply —
   *  throttles sync_request spam (see SYNC_REPLY_COOLDOWN_MS). */
  lastSyncReplyAtRef: { current: number };
  /** True once a peer `join` has been processed in this room. The
   *  sync_request gate keys off this — not game status — so a
   *  never-joined peer cannot pull full GameState (review 2026-10-03
   *  repair P2). */
  guestJoinedRef: { current: boolean };
  /** Once-per-move reconnect full-deadline-reset budget, consumed by
   *  relayEvents on welcome/peer-reconnected. Keyed on moveCount, which
   *  restarts each round — must be re-armed when a new game begins. */
  reconnectResetsRef: { current: { moveCount: number } };
  hostPendingSettingsRef: { current: PendingPlayerSettings | null };
  /** True while a mid-game overlay (Settings/Help/confirm) freezes the
   *  turn clock. The host owns the clock, so it must also refuse inbound
   *  guest moves while frozen — otherwise the guest keeps playing against a
   *  stopped timer and the host's "frozen" turn silently resets to 10s. */
  pausedRef: { current: boolean };
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  commitHostState: (gameState: GameState) => void;
  broadcastGameState: (gameState: GameState) => void;
  stopTimer: () => void;
  clearRematchTimeout: () => void;
}

/**
 * Re-syncs the guest with the host's authoritative state.
 *
 * The relay reserves the `error` frame type for itself and answers a
 * client-sent one back to the *sender*, so the host can never deliver an
 * `error` to the guest (fuurma-matchmaking/src/room.ts RESERVED_TYPES).
 * Every "your assumption was wrong, resync" path therefore ships a
 * `gameUpdate` instead: the guest's handler replaces its board wholesale,
 * which both rolls back a bad optimistic move and repairs any other drift.
 */
function resyncGuest(deps: HostProtocolDeps) {
  const { roomRef, stateRef } = deps;
  roomRef.current?.send({
    type: "gameUpdate",
    gameState: toWireGameState(stateRef.current),
  });
}

export function applyHostMove(deps: HostProtocolDeps, index: number, actor: PlayerSymbol) {
  const { stateRef, hostSymbolRef, commitHostState, pausedRef } = deps;
  {
    // Mirrors sendMove's pause gate: the clock is frozen, so no move may
    // commit — not the host's own click, and not a guest move arriving over
    // the wire. Accepted either way it would restart the turn at a full
    // TURN_DURATION_MS and hand the guest free time.
    if (pausedRef.current) return;
    const current = stateRef.current;
    const next = applyAuthorizedMove(current, index, actor);
    if (!next) {
      // Only the guest's failed moves need a wire correction — it drives the
      // guest's optimistic-move rollback. The host's own moves are validated
      // locally and never need one. No null special-case: every caller
      // already rejects an unassigned hostSymbol before dispatching here, and
      // a real actor symbol never equals a null ref anyway, so the resync
      // would still go out and the guest would roll back rather than diverge
      // (F160 — the old `hostSymbol === null` early-return was unreachable
      // dead code).
      if (actor !== hostSymbolRef.current) {
        resyncGuest(deps);
      }
      return;
    }
    // makeMove already sets turnTimeRemaining to a full TURN_DURATION_MS
    // for the next player — no override needed (devin 09-07 finding 5).
    commitHostState(next);
  }
}

/**
 * Resets the room to a fresh game with randomly swapped symbols and
 * broadcasts the new authoritative state.
 *
 * Shared by both ways a rematch can start now that either side may ask:
 * the guest accepting the host's request (arrives as `rematchAccept`) and
 * the host accepting the guest's request (a local action, no wire message
 * — the host is the authority, so it just resets and announces).
 */
function resetForRematch(deps: HostProtocolDeps, closePrompt: boolean) {
  const {
    stateRef,
    roomRef,
    hostSymbolRef,
    lastSyncReplyAtRef,
    reconnectResetsRef,
    hostPendingSettingsRef,
    setState,
    clearRematchTimeout,
  } = deps;
  const state = stateRef.current;
  clearRematchTimeout();
  const newHostSymbol: PlayerSymbol = randomPlayerSymbol();
  const newGuestSymbol = oppositeSymbol(newHostSymbol);
  // Read BOTH player configs from the OLD state BEFORE overwriting
  // hostSymbolRef — when symbols swap, indexing by the NEW symbol
  // would give each side the other player's name/color/shape
  // (fleet critic 2026-09-06 P1). A null ref means the room was never
  // initialized — resync the guest with the untouched state so it stops
  // waiting on a rematch that will never come (F159). An `error` frame
  // cannot do this: the relay reserves that type and bounces it back to
  // the sender.
  const oldHostSymbol = hostSymbolRef.current;
  if (oldHostSymbol === null) {
    resyncGuest(deps);
    return;
  }
  const hostPlayer = state.players[oldHostSymbol];
  const guestPlayer = state.players[oppositeSymbol(oldHostSymbol)];
  hostSymbolRef.current = newHostSymbol;
  // If the host edited their identity mid-game via the edit button,
  // pull that into the next match instead of keeping the previous one.
  const pending = hostPendingSettingsRef.current;
  const hostName = pending
    ? sanitizeDisplayName(pending.displayName, hostPlayer.username)
    : hostPlayer.username;
  const hostColor = pending?.color ?? hostPlayer.color;
  const hostShape = pending?.playerShape ?? hostPlayer.shape;
  if (pending) hostPendingSettingsRef.current = null;
  const reset = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: newHostSymbol === PlayerSymbol.X ? hostName : guestPlayer.username,
    playerOName: newHostSymbol === PlayerSymbol.O ? hostName : guestPlayer.username,
    playerColor: hostColor,
    opponentColor: guestPlayer.color,
    playerShape: hostShape,
    opponentShape: guestPlayer.shape,
    humanSymbol: newHostSymbol,
  });
  stateRef.current = reset;
  // New game = new sync window: a guest catch-up pull arriving right
  // after the rematch gameStart must be answered, not throttled by
  // the previous game's last reply (review 2026-10-03 repair P2).
  disarmSyncReplyThrottle(lastSyncReplyAtRef);
  // New game = fresh reconnect-reset budget too (F362): the once-per-
  // move full-deadline reset is keyed on moveCount, which just
  // restarted at 0 — the old game's consumed budget would deny the
  // reset at the same moveCount in this round.
  reconnectResetsRef.current.moveCount = -1;
  setState((prev) => ({
    ...prev,
    hostSymbol: newHostSymbol,
    guestSymbol: newGuestSymbol,
    gameState: reset,
    message: "",
    rematchOutgoing: false,
    rematchIncoming: closePrompt ? false : prev.rematchIncoming,
  }));
  // gameStart alone carries the reset + the swapped guest symbol —
  // a gameUpdate alongside it duplicated the same state on the wire
  // and was applied twice by the guest's shared handler branch
  // (fleet brief 62c86d31).
  roomRef.current?.send({ type: "gameStart", symbol: newGuestSymbol, gameState: toWireGameState(reset) });
}

/**
 * The host accepts a rematch the guest asked for. Local action only: the
 * host owns the room, so it resets and announces rather than sending an
 * accept and waiting for its own echo.
 */
export function acceptIncomingRematch(deps: HostProtocolDeps) {
  // Connection state and the visible prompt belong to the hook; this
  // guards only the rule the protocol owns: a finished game.
  const { stateRef, rematchPendingRef } = deps;
  const state = stateRef.current;
  if (state.winner === null || state.gameStatus !== GameStatus.COMPLETED) return;
  rematchPendingRef.current = false;
  resetForRematch(deps, true);
}

/**
 * Handles one peer message addressed to the host (routed by role in
 * buildRoomClient).
 */
export function handleHostMessage(deps: HostProtocolDeps, message: PeerMessage) {
  const {
    stateRef,
    roomRef,
    hostSymbolRef,
    rematchPendingRef,
    lastSyncReplyAtRef,
    guestJoinedRef,
    setState,
    stopTimer,
    clearRematchTimeout,
  } = deps;
  {
    if (message.type === "join") {
      // hostSymbolRef is assigned synchronously in startAsHost; a null
      // here means the room was never initialized — resync the guest with
      // the untouched state rather than leaving it waiting on `joined`
      // forever (F159: a silent drop strands the guest on a spinner).
      const hostSymbol = hostSymbolRef.current;
      if (hostSymbol === null) {
        resyncGuest(deps);
        return;
      }
      const result = applyHostGuestJoin(stateRef.current, hostSymbol, {
        displayName: message.displayName,
        preferredColor: message.preferredColor,
      });
      stateRef.current = result.gameState;
      // A real join unlocks sync pulls and starts a fresh throttle
      // window — a (re)joining guest's catch-up pull must not inherit a
      // cooldown still running from before the disconnect (review
      // 2026-10-03 repair P2).
      guestJoinedRef.current = true;
      disarmSyncReplyThrottle(lastSyncReplyAtRef);
      // Send the WIRE payload (deadline stripped, fresh remaining) — the
      // host state keeps its own deadline for turn expiry (fleet 09-08
      // devin report: this send site had shipped the stale state).
      const wireGameState = result.wireGameState;
      roomRef.current?.send({
        type: "joined",
        symbol: result.guestSymbol,
        color: result.guestColor,
        gameState: wireGameState,
      });
      roomRef.current?.send(
        result.kind === "accepted"
          ? { type: "gameStart", symbol: result.guestSymbol, gameState: wireGameState }
          : { type: "gameUpdate", gameState: wireGameState },
      );
      if (result.kind === "accepted") {
        setState((prev) => ({
          ...prev,
          status: "connected",
          guestSymbol: result.guestSymbol,
          gameState: result.gameState,
          message: "",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "connected",
          guestSymbol: result.guestSymbol,
          gameState: result.gameState,
        }));
      }
      return;
    }
    if (message.type === "sync_request") {
      // Reconnect pull (uno-chess contract, DST-04): the guest asks for
      // an authoritative snapshot after reconnecting. The host answers
      // with the current wire state — deadline stripped so the guest
      // resynthesizes its own clock. Read-only: never mutates host
      // state, safe against a stray or replayed request.
      // Gate on a join actually having landed — not on status alone
      // (review 2026-10-03 repair P2): status only blocks WAITING, so a
      // peer that never sent `join` could pull full GameState
      // (names/colors) while the game sat ACTIVE or COMPLETED — the same
      // pre-join leak, one status later. The WAITING check stays as
      // defense-in-depth (a real join always leaves WAITING).
      if (!guestJoinedRef.current) return;
      if (stateRef.current.gameStatus === GameStatus.WAITING) return;
      // Throttle (review 2026-10-03 repair P2): without a bound any peer
      // can spam full-state pulls and the host answers every one.
      // performance.now() is monotonic — wall-clock jumps can't lock the
      // window out or farm it (review 2026-10-03 repair P3).
      const now = performance.now();
      if (now - lastSyncReplyAtRef.current < SYNC_REPLY_COOLDOWN_MS) return;
      lastSyncReplyAtRef.current = now;
      roomRef.current?.send({
        type: "state_snapshot",
        gameState: toWireGameState(stateRef.current),
      });
      return;
    }
    if (message.type === "move") {
      const hostSymbol = hostSymbolRef.current;
      // A null ref means the room was never initialized — resync the guest
      // with the untouched state so its optimistic move is withdrawn instead
      // of diverging on a silent drop (F159).
      if (hostSymbol === null) {
        resyncGuest(deps);
        return;
      }
      const guestSymbol = oppositeSymbol(hostSymbol);
      applyHostMove(deps, message.index, guestSymbol);
      return;
    }
    if (message.type === "rematchRequested") {
      // Either side may ask for another game. Mirror the guest's prompt
      // gate exactly: only on a finished game, and only from a peer that
      // actually joined this room — a peer that never sent `join` must not
      // be able to pop a rematch prompt over live play.
      const state = stateRef.current;
      if (
        !guestJoinedRef.current ||
        state.winner === null ||
        state.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      // A second request while one is already pending is a no-op: the
      // prompt is up, and the pending flag belongs to whoever asked first.
      if (rematchPendingRef.current) return;
      setState((prev) => {
        if (prev.rematchIncoming) return prev;
        return {
          ...prev,
          message: `${state.players[message.requesterSymbol].username} wants a rematch. Accept or decline below.`,
          rematchIncoming: true,
        };
      });
      return;
    }
    if (message.type === "rematchCancel") {
      // The guest withdrew their request before the host responded. Gate
      // on the explicit flag, never on the message copy.
      setState((prev) =>
        prev.rematchIncoming
          ? { ...prev, message: "Rematch request withdrawn", rematchIncoming: false }
          : prev,
      );
      return;
    }
    if (message.type === "rematchAccept") {
      const state = stateRef.current;
      // Two gates:
      // 1. The host must have issued a rematch request that's still pending.
      //    A stray guest message without a pending request is ignored.
      // 2. The current game must already be terminal — we never reset a
      //    game that's still in progress, even if both sides agree.
      if (
        !rematchPendingRef.current ||
        state.winner === null ||
        state.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      rematchPendingRef.current = false;
      resetForRematch(deps, false);
      return;
    }
    if (message.type === "rematchDecline") {
      // F254: mirror rematchAccept's pending gate — a stray decline with no
      // outstanding request must not stamp "Rematch declined" over live UI.
      if (!rematchPendingRef.current) return;
      rematchPendingRef.current = false;
      clearRematchTimeout();
      setState((prev) => ({ ...prev, message: "Rematch declined", rematchOutgoing: false }));
      return;
    }
    if (message.type === "leave") {
      stopTimer();
      rematchPendingRef.current = false;
      clearRematchTimeout();
      const state = stateRef.current;
      // Host wins by forfeit when the guest leaves (unless the game
      // already had a winner). Symbols randomize per rematch — prefer
      // the live ref, fall back to the state-recorded symbol, and crown
      // nobody rather than guess X/O when neither is known yet.
      setState((prev) => {
        const hostSymbol = hostSymbolRef.current ?? prev.hostSymbol;
        const ended = applyForfeitIfActive(state, hostSymbol);
        stateRef.current = ended;
        return {
          ...prev,
          status: "disconnected" as const,
          gameState: ended,
          message: "Opponent left",
          rematchOutgoing: false,
        };
      });
      return;
    }
    // NOTE: the host never receives {type:"error", message:"Invalid
    // move"} — the host SENDS it. The rollback branch for that message
    // lives in guestProtocol.ts (fleet critic 2026-09-06: it was
    // misplaced here, making the guest rollback dead code).
  }
}
