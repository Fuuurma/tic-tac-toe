import {
  Color,
  GAME_ID,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  SymbolShape,
  oppositeSymbol,
  randomPlayerSymbol,
} from "@/game/constants";
import { createInitialGameState, freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import {
  chooseGuestColor,
  generateRoomId,
  isPeerMessage,
} from "@/lib/peer";
import type { PeerMessage } from "@/lib/peer";
import {
  buildRoomWsUrl,
} from "@/lib/matchmaking";
import { generateGuestDisplayName, getOrCreateGuestIdentity, sanitizeDisplayName } from "@/lib/identity";
import { RoomClient } from "@/lib/room";
import { disarmSyncReplyThrottle } from "./hostProtocol";
import type { PeerRoomState, PendingPlayerSettings } from "../usePeerRoom";

/**
 * Room lifecycle controller, extracted from usePeerRoom (god-hook
 * decomposition, slice 4): builds the relay RoomClient (routing
 * messages by role), opens a room as host, joins as guest, and tears
 * down on leave.
 */
export interface RoomLifecycleDeps {
  roomRef: { current: RoomClient | null };
  stateRef: { current: GameState };
  roleRef: { current: "host" | "guest" | null };
  hostSymbolRef: { current: PlayerSymbol | null };
  guestSymbolRef: { current: PlayerSymbol | null };
  hostDisplayName: string;
  hostColor: Color;
  hostShape?: SymbolShape;
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  update: (patch: Partial<PeerRoomState>) => void;
  handleWsEvent: (event: { type: string; [k: string]: unknown }) => void;
  handleHostData: (message: PeerMessage) => void;
  handleGuestData: (message: PeerMessage) => void;
  stopTimer: () => void;
  rematchPendingRef: { current: boolean };
  /** Sync-reply throttle clock (hostProtocol) — disarmed on room entry
   *  so the first pull of a new room is never dropped by the previous
   *  room's cooldown (review 2026-10-03 repair P2). */
  lastSyncReplyAtRef: { current: number };
  /** Join gate for sync_request — cleared on room entry so a stale
   *  "guest joined" can never leak into the next room. */
  guestJoinedRef: { current: boolean };
  hostPendingSettingsRef: { current: PendingPlayerSettings | null };
  /** Once-per-move reconnect full-deadline-reset budget (relayEvents) —
   *  cleared on room entry like the other room-scoped refs: its
   *  moveCount key restarts each game, so a consumed budget must not
   *  leak into the next room/round (F362). */
  reconnectResetsRef: { current: { moveCount: number } };
  /** Guest optimistic-move rollback snapshot (guestProtocol) — room-scoped:
   *  a snapshot from a previous room can only resurrect that room's state,
   *  so it is cleared on entry with the rest of the carried-over state. */
  pendingGuestStateRef: { current: GameState | null };
}

/** Graceful teardown: notify the peer/relay BEFORE closing the socket.
 *  F7 regression pin — every close path must send `{type:"leave"}` first;
 *  a frame sent after close is silently dropped, so the peer never learns
 *  the room was left deliberately. Best-effort: send's boolean is ignored
 *  (a dead socket simply can't deliver). No-op on a null ref. */
export function leaveRoom(roomRef: { current: RoomClient | null }) {
  if (roomRef.current) {
    roomRef.current.send({ type: "leave" });
    roomRef.current.close();
    roomRef.current = null;
  }
}

/** Closes any open room connection before opening a new one. Without
 *  this, a "Try again" after a timeout leaves the old WebSocket open,
 *  and its message handler can corrupt the new room's state via
 *  shared refs. */
function closeExistingRoom(roomRef: RoomLifecycleDeps["roomRef"]) {
  leaveRoom(roomRef);
}

export function buildRoomClient(deps: RoomLifecycleDeps, wsUrl: string, role: "host" | "guest"): RoomClient {
  const { stateRef, roleRef, setState, handleWsEvent, handleHostData, handleGuestData } = deps;
  const identity = getOrCreateGuestIdentity();
  const client = new RoomClient({
    wsUrl,
    game: GAME_ID,
    guestId: identity.guestId,
    displayName: deps.hostDisplayName,
    role,
  });
  client.setMessageHandler((msg) => {
    // Relay errors carry a `code` field (lib/room.ts ErrorMessage);
    // HOST-sent `{type:"error"}` peer messages do not. Routing every
    // type:"error" to the relay handler swallowed the host's
    // "Invalid move" message, leaving the guest's optimistic-move
    // rollback dead (fleet critic 2026-09-06 P2).
    // Validate code is a non-empty string — a peer adding `code:"x"`
    // to a peer error would otherwise bypass isPeerMessage validation
    // (fleet audit 2026-09-06 P4).
    const isRelayError =
      msg.type === "error" &&
      "code" in msg &&
      typeof msg.code === "string" &&
      msg.code.length > 0;
    if (msg.type === "welcome" || msg.type === "peer-joined" || msg.type === "peer-reconnected" || msg.type === "peer-left" || isRelayError) {
      handleWsEvent(msg as { type: string; [k: string]: unknown });
      if (msg.type === "welcome" && role === "guest") {
        const identity = getOrCreateGuestIdentity();
        client.send({
          type: "join",
          displayName: deps.hostDisplayName,
          guestId: identity.guestId,
          preferredColor: deps.hostColor,
        });
      }
      // F252: the guest's one-shot join fanned out to zero peers if the
      // host socket was down (reconnect grace). When the host comes back
      // the guest gets peer-reconnected — if the game is still WAITING the
      // join was lost and the handshake never ran, so resend it.
      if (
        msg.type === "peer-reconnected" &&
        role === "guest" &&
        deps.stateRef.current.gameStatus === GameStatus.WAITING
      ) {
        const identity = getOrCreateGuestIdentity();
        client.send({
          type: "join",
          displayName: deps.hostDisplayName,
          guestId: identity.guestId,
          preferredColor: deps.hostColor,
        });
      }
    } else if (isPeerMessage(msg)) {
      // isPeerMessage is a type predicate — msg is already PeerMessage.
      if (stateRef.current && roleRef.current) {
        if (roleRef.current === "host") {
          handleHostData(msg);
        } else {
          handleGuestData(msg);
        }
      }
    }
  });
  client.setStatusHandler((status, detail) => {
    if (status === "connected" && roleRef.current === null) {
      // initial room connect: status will be set in welcome handler
    } else if (status === "reconnecting") {
      // needs-work 10-03 P2: guard the transient writes so transport-side
      // copies can't overwrite the relay's peer-specific grace message
      // ("Host disconnected. Reconnecting…" / peer-left reason lines).
      setState((prev) => {
        if (prev.status === "reconnecting" && !detail) return prev;
        return { ...prev, status: "reconnecting", message: detail ?? "Reconnecting..." };
      });
    } else if (status === "disconnected") {
      setState((prev) => {
        // Terminal relay messages (peer-left reason lines) win over the
        // transport's generic "You left"/"Disconnected" — the relay frame
        // is the authoritative reason (needs-work 10-03 P1).
        if (prev.status === "disconnected" && prev.message && prev.message !== "You left") {
          return prev;
        }
        return { ...prev, status: "disconnected", message: detail ?? "Disconnected" };
      });
    } else if (status === "error") {
      setState((prev) => ({ ...prev, status: "error", message: detail ?? "Connection error" }));
    }
  });
  deps.roomRef.current = client;
  return client;
}

export function startAsHost(deps: RoomLifecycleDeps, providedRoomId?: string, wsUrl?: string) {
  const {
    roomRef,
    stateRef,
    roleRef,
    hostDisplayName,
    hostColor,
    hostShape,
    update,
    stopTimer,
  } = deps;
  stopTimer();
  closeExistingRoom(roomRef);
  // A stale pending-rematch flag must not leak into the new room —
  // without this a stray rematchAccept arriving right after the room
  // swap is honored against a game that never asked for one
  // (needs-work 2026-09-10 P2).
  deps.rematchPendingRef.current = false;
  // F241: pending identity edits are room-scoped — a leftover from the
  // previous room would apply silently on the next room's rematch accept.
  deps.hostPendingSettingsRef.current = null;
  // Sync state is room-scoped too (review 2026-10-03 repair P2): the
  // joined gate must re-arm (no peer has joined THIS room yet) and the
  // reply throttle must not carry a cooldown over from the last room.
  deps.guestJoinedRef.current = false;
  disarmSyncReplyThrottle(deps.lastSyncReplyAtRef);
  deps.reconnectResetsRef.current.moveCount = -1;
  // Room-scoped like the rest: a snapshot taken in a previous room is
  // never a valid rollback target in this one (F275).
  deps.pendingGuestStateRef.current = null;
  const roomId = providedRoomId ?? generateRoomId();
  const hostSymbol: PlayerSymbol = randomPlayerSymbol();
  const guestSymbol = oppositeSymbol(hostSymbol);
  const waitingGame = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName:
      hostSymbol === PlayerSymbol.X
        ? sanitizeDisplayName(hostDisplayName, generateGuestDisplayName())
        : "Waiting for opponent",
    playerOName:
      hostSymbol === PlayerSymbol.O
        ? sanitizeDisplayName(hostDisplayName, generateGuestDisplayName())
        : "Waiting for opponent",
    playerColor: hostColor,
    opponentColor: chooseGuestColor(Color.BLUE, hostColor),
    playerShape: hostShape ?? PLAYER_CONFIG[hostSymbol].defaultShape,
    humanSymbol: hostSymbol,
  });
  waitingGame.gameStatus = GameStatus.WAITING;
  stateRef.current = waitingGame;
  deps.hostSymbolRef.current = hostSymbol;
  update({
    role: "host",
    status: "creating",
    roomId,
    hostSymbol,
    guestSymbol,
    gameState: waitingGame,
    message: "",
    rematchOutgoing: false,
  });
  roleRef.current = "host";

  const resolvedUrl = wsUrl ?? buildRoomWsUrl(roomId);
  const room = buildRoomClient(deps, resolvedUrl, "host");
  room.connect().catch((err) => {
    update({ status: "error", message: `Room connect failed: ${(err as Error).message}` });
  });
}

export function joinAsGuest(deps: RoomLifecycleDeps, roomId: string, wsUrl?: string) {
  const { roomRef, roleRef, update, stopTimer } = deps;
  stopTimer();
  closeExistingRoom(roomRef);
  deps.rematchPendingRef.current = false;
  deps.hostPendingSettingsRef.current = null;
  deps.guestJoinedRef.current = false;
  disarmSyncReplyThrottle(deps.lastSyncReplyAtRef);
  deps.reconnectResetsRef.current.moveCount = -1;
  const trimmed = roomId.trim();
  if (!trimmed) {
    update({ status: "error", message: "Enter a room ID" });
    return;
  }
  // The guest's symbol is assigned by the host's `joined` message — clear
  // any symbol carried over from a previous room so a peer leaving before
  // `joined` arrives crowns nobody instead of a stale recorded symbol.
  deps.guestSymbolRef.current = null;
  // F275: the carried-over GameState belongs to the previous room — every
  // gameStatus gate in this stack reads stateRef (the F252 join resend, the
  // welcome sync pull, the rematchRequested terminal gate), so a stale
  // COMPLETED/ACTIVE reports "game in progress" for a room that has not
  // started and suppresses the resend that unstrands the guest. Seed a
  // fresh WAITING placeholder; the host's `joined`/`gameStart` replaces it
  // wholesale. The optimistic rollback snapshot is room-scoped too — a
  // stray "Invalid move" before that first frame would resurrect the old
  // state.
  const waitingState: GameState = { ...freshGameState(), gameMode: GameModes.ONLINE };
  deps.stateRef.current = waitingState;
  deps.pendingGuestStateRef.current = null;
  update({ role: "guest", status: "connecting", roomId: trimmed, guestSymbol: null, gameState: waitingState, message: "Connecting...", rematchOutgoing: false });
  roleRef.current = "guest";

  const resolvedUrl = wsUrl ?? buildRoomWsUrl(trimmed);
  const room = buildRoomClient(deps, resolvedUrl, "guest");
  room.connect().catch((err) => {
    update({ status: "error", message: `Room connect failed: ${(err as Error).message}` });
  });
}
