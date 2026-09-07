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
import { createInitialGameState } from "@/game/logic";
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
import type { PeerRoomState } from "../usePeerRoom";

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
  hostDisplayName: string;
  hostColor: Color;
  hostShape?: SymbolShape;
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  update: (patch: Partial<PeerRoomState>) => void;
  handleWsEvent: (event: { type: string; [k: string]: unknown }) => void;
  handleHostData: (message: PeerMessage) => void;
  handleGuestData: (message: PeerMessage) => void;
  stopTimer: () => void;
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
      setState((prev) => ({ ...prev, status: "reconnecting", message: detail ?? "Reconnecting..." }));
    } else if (status === "disconnected") {
      setState((prev) => ({ ...prev, status: "disconnected", message: detail ?? "Disconnected" }));
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
  });
  roleRef.current = "host";

  const resolvedUrl = wsUrl ?? buildRoomWsUrl(roomId, GAME_ID);
  const room = buildRoomClient(deps, resolvedUrl, "host");
  room.connect().catch((err) => {
    update({ status: "error", message: `Room connect failed: ${(err as Error).message}` });
  });
}

export function joinAsGuest(deps: RoomLifecycleDeps, roomId: string, wsUrl?: string) {
  const { roomRef, roleRef, update, stopTimer } = deps;
  stopTimer();
  closeExistingRoom(roomRef);
  const trimmed = roomId.trim();
  if (!trimmed) {
    update({ status: "error", message: "Enter a room ID" });
    return;
  }
  update({ role: "guest", status: "connecting", roomId: trimmed, message: "Connecting..." });
  roleRef.current = "guest";

  const resolvedUrl = wsUrl ?? buildRoomWsUrl(trimmed, GAME_ID);
  const room = buildRoomClient(deps, resolvedUrl, "guest");
  room.connect().catch((err) => {
    update({ status: "error", message: `Room connect failed: ${(err as Error).message}` });
  });
}
