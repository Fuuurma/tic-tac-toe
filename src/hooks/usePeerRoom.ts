import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import {
  AVAILABLE_COLORS,
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  TURN_DURATION_MS,
} from "@/game/constants";
import {
  createInitialGameState,
  freshGameState,
  isGameActive,
  makeMove,
  makeRandomMove,
} from "@/game/logic";
import type { GameState } from "@/game/logic";
import {
  applyAuthorizedMove,
  createGuestPeer,
  createHostPeer,
  generateRoomId,
  isPeerMessage,
  sendMessage,
} from "@/lib/peer";
import type { PeerMessage } from "@/lib/peer";
import { getOrCreateGuestIdentity, sanitizeDisplayName } from "@/lib/identity";
import {
  buildRoomWsUrl,
  findMatch,
  leaveMatch,
  pollMatch,
  type MatchmakingResponse,
} from "@/lib/matchmaking";
import { RoomClient } from "@/lib/room";

/**
 * Online play hook for tic-tac-toe.
 *
 * Two transports:
 *  - PeerJS P2P (legacy, default)
 *  - Cloudflare Durable Object WebSocket relay (opt-in via VITE_USE_WS_ROOM)
 *
 * Rollout: tic-tac-toe goes first per migration spec. Both transports
 * preserve the same public hook API so the consuming surface
 * (`OnlineGameSurface`) doesn't branch.
 *
 * Spec: newProjectsPlanner/migrations/2026-07-games-do-websocket-migration.md
 */

const USE_WS_ROOM: boolean =
  import.meta.env.VITE_USE_WS_ROOM === true ||
  import.meta.env.VITE_USE_WS_ROOM === "true";

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
  guestDisplayName: string;
  guestSymbol: PlayerSymbol | null;
  message: string;
  gameState: GameState;
}

const initialState: PeerRoomState = {
  role: null,
  status: "idle",
  roomId: "",
  guestDisplayName: "",
  guestSymbol: null,
  message: "",
  gameState: freshGameState(),
};

const sanitizeColor = (color: string | undefined): Color => {
  if (!color) return Color.BLUE;
  return (Object.values(Color) as string[]).includes(color) ? (color as Color) : Color.BLUE;
};

const chooseGuestColor = (preferred: Color, hostColor: Color): Color =>
  preferred !== hostColor
    ? preferred
    : AVAILABLE_COLORS.find((color) => color !== hostColor) ?? Color.GRAY;

export interface PeerRoomOptions {
  hostDisplayName: string;
  hostColor: Color;
  gameMode: typeof GameModes.ONLINE;
}

export function usePeerRoom(options: PeerRoomOptions) {
  const [state, setState] = useState<PeerRoomState>(initialState);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const roomRef = useRef<RoomClient | null>(null);
  const stateRef = useRef<GameState>(initialState.gameState);
  const roleRef = useRef<PeerRole>(null);
  const tickRef = useRef<number | null>(null);
  const matchmakingTicketRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);

  stateRef.current = state.gameState;
  roleRef.current = state.role;

  const update = useCallback((patch: Partial<PeerRoomState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const stopTimer = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const broadcastGameState = useCallback((gameState: GameState) => {
    if (USE_WS_ROOM) {
      roomRef.current?.send({ type: "gameUpdate", gameState });
    } else {
      const conn = connRef.current;
      if (conn?.open) sendMessage(conn, { type: "gameUpdate", gameState });
    }
  }, []);

  const commitHostState = useCallback(
    (gameState: GameState) => {
      stateRef.current = gameState;
      setState((prev) => ({ ...prev, gameState }));
      broadcastGameState(gameState);
    },
    [broadcastGameState],
  );

  const startTimer = useCallback(() => {
    stopTimer();
    tickRef.current = window.setInterval(() => {
      const current = stateRef.current;
      if (!isGameActive(current)) {
        stopTimer();
        return;
      }
      const remaining = (current.turnTimeRemaining ?? TURN_DURATION_MS) - 1000;
      if (remaining <= 0) {
        const random = makeRandomMove(current.board);
        if (random === null) return;
        const updated = makeMove(current, random);
        if (!updated) return;
        const gameState = { ...updated, turnTimeRemaining: TURN_DURATION_MS };
        stateRef.current = gameState;
        setState((prev) => ({
          ...prev,
          gameState,
          message: `${current.players[current.currentPlayer].username || "Player"} ran out of time`,
        }));
        broadcastGameState(gameState);
        return;
      }
      const gameState = { ...current, turnTimeRemaining: remaining };
      commitHostState(gameState);
    }, 1000);
  }, [broadcastGameState, commitHostState, stopTimer]);

  const applyHostMove = useCallback(
    (index: number, actor: PlayerSymbol) => {
      const current = stateRef.current;
      const next = applyAuthorizedMove(current, index, actor);
      if (!next) {
        if (actor === PlayerSymbol.O) {
          if (USE_WS_ROOM) {
            roomRef.current?.send({ type: "error", message: "Invalid move" });
          } else {
            const conn = connRef.current;
            if (conn?.open) sendMessage(conn, { type: "error", message: "Invalid move" });
          }
        }
        return;
      }
      commitHostState({ ...next, turnTimeRemaining: TURN_DURATION_MS });
    },
    [commitHostState],
  );

  const handleHostData = useCallback(
    (message: PeerMessage) => {
      if (message.type === "join") {
        const state = stateRef.current;
        const guestSymbol = PlayerSymbol.O;
        const guestColor = chooseGuestColor(
          sanitizeColor(message.preferredColor),
          state.players[PlayerSymbol.X].color,
        );
        const guestDisplayName = sanitizeDisplayName(message.displayName, "Guest");
        const updated: GameState = {
          ...state,
          gameStatus: GameStatus.ACTIVE,
          players: {
            ...state.players,
            [guestSymbol]: {
              username: guestDisplayName,
              color: guestColor,
              symbol: guestSymbol,
              type: PlayerTypes.HUMAN,
              isActive: true,
              lastMoveAt: Date.now(),
            },
          },
        };
        stateRef.current = updated;
        if (USE_WS_ROOM) {
          roomRef.current?.send({ type: "joined", symbol: guestSymbol, color: guestColor, gameState: updated });
          roomRef.current?.send({ type: "gameStart", gameState: updated });
        } else {
          const conn = connRef.current;
          if (conn?.open) {
            sendMessage(conn, { type: "joined", symbol: guestSymbol, color: guestColor, gameState: updated });
            sendMessage(conn, { type: "gameStart", gameState: updated });
          }
        }
        setState((prev) => ({
          ...prev,
          status: "connected",
          guestDisplayName,
          guestSymbol: guestSymbol,
          gameState: updated,
          message: "",
        }));
        return;
      }
      if (message.type === "move") {
        applyHostMove(message.index, PlayerSymbol.O);
        return;
      }
      if (message.type === "rematchAccept") {
        const state = stateRef.current;
        const reset = createInitialGameState({
          gameMode: GameModes.ONLINE,
          playerXName: state.players[PlayerSymbol.X].username,
          playerOName: state.players[PlayerSymbol.O].username,
          playerColor: state.players[PlayerSymbol.X].color,
          opponentColor: state.players[PlayerSymbol.O].color,
        });
        reset.players[PlayerSymbol.O].isActive = true;
        commitHostState(reset);
        return;
      }
      if (message.type === "rematchDecline") {
        setState((prev) => ({ ...prev, message: "Rematch declined" }));
        return;
      }
      if (message.type === "leave") {
        stopTimer();
        const state = stateRef.current;
        const ended: GameState = {
          ...state,
          winner: PlayerSymbol.X,
          gameStatus: GameStatus.COMPLETED,
        };
        stateRef.current = ended;
        setState((prev) => ({ ...prev, gameState: ended, message: "Opponent left" }));
        return;
      }
    },
    [applyHostMove, commitHostState, stopTimer],
  );

  const handleWsEvent = useCallback(
    (event: { type: string; [k: string]: unknown }) => {
      if (event.type === "welcome") {
        const role = (event as { role?: string }).role;
        const opponent = (event as { opponent?: { guestId: string; displayName: string } | null }).opponent ?? null;
        if (role === "host") {
          // Host wakes up (initial or reconnect). If opponent present, they're
          // already back; if not, wait for peer-joined.
          if (opponent) {
            setState((prev) => ({
              ...prev,
              role: "host",
              status: "connected",
              guestDisplayName: opponent.displayName,
              guestSymbol: PlayerSymbol.O,
              message: "",
            }));
          } else {
            setState((prev) => ({
              ...prev,
              role: "host",
              status: prev.status === "connected" ? "connected" : "waiting",
              message: prev.status === "connected" ? "" : `Room ${prev.roomId} — waiting for opponent`,
            }));
          }
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
        if (roleRef.current === "guest") {
          stopTimer();
          const gameState = {
            ...stateRef.current,
            gameStatus: GameStatus.COMPLETED,
          };
          stateRef.current = gameState;
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            gameState,
            message: "Host disconnected",
          }));
          return;
        }
        if (roleRef.current === "host") {
          stopTimer();
          const current = stateRef.current;
          const gameState = current.winner
            ? current
            : { ...current, winner: PlayerSymbol.X, gameStatus: GameStatus.COMPLETED };
          stateRef.current = gameState;
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            gameState,
            message: "Opponent disconnected",
          }));
          return;
        }
        return;
      }
      if (event.type === "error") {
        setState((prev) => ({
          ...prev,
          message: String((event as { message?: string }).message ?? "Room error"),
        }));
        return;
      }
    },
    [stopTimer],
  );

  const handleGuestData = useCallback(
    (message: PeerMessage) => {
      if (message.type === "joined" || message.type === "gameStart" || message.type === "gameUpdate") {
        stateRef.current = message.gameState;
        setState((prev) => {
          const localSymbol =
            message.type === "joined" && message.symbol
              ? message.symbol
              : prev.guestSymbol;
          return {
            ...prev,
            status: "connected",
            gameState: message.gameState,
            guestSymbol: localSymbol,
            guestDisplayName:
              localSymbol === PlayerSymbol.O
                ? message.gameState.players[PlayerSymbol.X].username
                : message.gameState.players[PlayerSymbol.O].username,
            message: "",
          };
        });
        return;
      }
      if (message.type === "rematchRequested") {
        const state = stateRef.current;
        setState((prev) => ({
          ...prev,
          message: `${state.players[message.requesterSymbol].username} wants a rematch — click Play Again to accept`,
        }));
        return;
      }
      if (message.type === "error") {
        setState((prev) => ({ ...prev, message: message.message }));
        return;
      }
    },
    [],
  );

  const buildRoomClient = useCallback((wsUrl: string, role: "host" | "guest"): RoomClient => {
    const identity = getOrCreateGuestIdentity();
    const client = new RoomClient({
      wsUrl,
      game: "tictactoe",
      guestId: identity.guestId,
      displayName: options.hostDisplayName,
      role,
    });
    client.setMessageHandler((msg) => {
      if (msg.type === "welcome" || msg.type === "peer-joined" || msg.type === "peer-left" || msg.type === "error") {
        handleWsEvent(msg as { type: string; [k: string]: unknown });
      } else if (isPeerMessage(msg)) {
        const m = msg as PeerMessage;
        if (stateRef.current && roleRef.current) {
          if (roleRef.current === "host") {
            handleHostData(m);
          } else {
            handleGuestData(m);
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
    roomRef.current = client;
    return client;
  }, [handleGuestData, handleHostData, handleWsEvent, options.hostDisplayName]);

  const startAsHost = useCallback(
      (providedRoomId?: string, wsUrl?: string) => {
        stopTimer();
        const roomId = providedRoomId ?? generateRoomId();
        const waitingGame = createInitialGameState({
        gameMode: GameModes.ONLINE,
        playerXName: sanitizeDisplayName(options.hostDisplayName, "Host"),
        playerOName: "Waiting for opponent",
        playerColor: options.hostColor,
        opponentColor: chooseGuestColor(Color.BLUE, options.hostColor),
    });
        waitingGame.gameStatus = GameStatus.WAITING;
        stateRef.current = waitingGame;
        update({
        role: "host",
        status: "creating",
        roomId,
        guestDisplayName: "",
        guestSymbol: PlayerSymbol.O,
        gameState: waitingGame,
        message: "",
    });

      if (USE_WS_ROOM) {
        if (!wsUrl) {
          update({ status: "error", message: "Missing wsUrl for room relay" });
          return;
        }
        const room = buildRoomClient(wsUrl, "host");
        room.connect().catch((err) => {
          update({ status: "error", message: `Room connect failed: ${err.message}` });
        });
        return;
      }

      const peer = createHostPeer(roomId);
      peerRef.current = peer;
      peer.on("open", () => {
        update({ status: "waiting", message: `Room ${roomId} — waiting for opponent` });
    });
      peer.on("connection", (conn) => {
        if (connRef.current?.open) {
          conn.on("open", () => {
            sendMessage(conn, { type: "error", message: "Room is full" });
            conn.close();
        });
          return;
        }
        connRef.current = conn;
        conn.on("open", () => {
          update({ status: "connecting" });
      });
        conn.on("data", (raw) => {
          if (isPeerMessage(raw)) handleHostData(raw);
      });
        conn.on("close", () => {
          stopTimer();
          const current = stateRef.current;
          const gameState = current.winner
            ? current
            : { ...current, winner: PlayerSymbol.X, gameStatus: GameStatus.COMPLETED };
          stateRef.current = gameState;
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            gameState,
            message: "Opponent disconnected",
          }));
      });
        conn.on("error", (err) => {
          update({ status: "error", message: `Connection error: ${(err as Error).message}` });
      });
    });
      peer.on("error", (err) => {
        update({
          status: "error",
          message: `Peer error (${err.type}): ${(err as Error).message}`,
      });
    });
  }, [buildRoomClient, handleHostData, options.hostColor, options.hostDisplayName, stopTimer, update]);

  const joinAsGuest = useCallback(
    (roomId: string, wsUrl?: string) => {
      stopTimer();
      const trimmed = roomId.trim();
      if (!trimmed) {
        update({ status: "error", message: "Enter a room ID" });
        return;
      }
      update({ role: "guest", status: "connecting", roomId: trimmed, message: "Connecting..." });

      if (USE_WS_ROOM) {
        if (!wsUrl) {
          update({ status: "error", message: "Missing wsUrl for room relay" });
          return;
        }
        const room = buildRoomClient(wsUrl, "guest");
        room.connect()
          .then(() => {
            // After welcome, send the join message so the host can build state.
            room.send({
              type: "join",
              displayName: options.hostDisplayName,
              guestId: getOrCreateGuestIdentity().guestId,
              preferredColor: options.hostColor,
            });
          })
          .catch((err) => {
            update({ status: "error", message: `Room connect failed: ${err.message}` });
          });
        return;
      }

      const peer = createGuestPeer();
      peerRef.current = peer;
      peer.on("open", () => {
        const conn = peer.connect(trimmed, { reliable: true });
        connRef.current = conn;
        conn.on("open", () => {
          sendMessage(conn, {
            type: "join",
            displayName: options.hostDisplayName,
            guestId: "guest",
            preferredColor: options.hostColor,
          });
        });
        conn.on("data", (raw) => {
          if (isPeerMessage(raw)) handleGuestData(raw);
        });
        conn.on("close", () => {
          stopTimer();
          const gameState = {
            ...stateRef.current,
            gameStatus: GameStatus.COMPLETED,
          };
          stateRef.current = gameState;
          setState((prev) => ({
            ...prev,
            status: "disconnected",
            gameState,
            message: "Host disconnected",
          }));
        });
        conn.on("error", (err) => {
          update({ status: "error", message: `Connection error: ${(err as Error).message}` });
        });
      });
      peer.on("error", (err) => {
        update({
          status: "error",
          message: `Peer error (${err.type}): ${(err as Error).message}`,
        });
      });
    },
    [buildRoomClient, handleGuestData, options.hostColor, options.hostDisplayName, stopTimer, update],
  );

  const startQuickMatch = useCallback(async () => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    stopTimer();
    update({ status: "creating", message: "Finding match…" });
    const identity = getOrCreateGuestIdentity();
    const sessionId = crypto.randomUUID();
    try {
      const response: MatchmakingResponse = await findMatch({
        game: "tictactoe",
        peerId: sessionId,
        displayName: options.hostDisplayName,
        guestId: identity.guestId,
      });

      if (response.status === "waiting") {
        matchmakingTicketRef.current = response.ticket;
        const wsUrl = USE_WS_ROOM ? buildRoomWsUrl(response.roomId, "tictactoe") : undefined;
        startAsHost(response.roomId, wsUrl);

        // Poll the matchmaking service until the guest is paired.
        // Bounded by a max duration and the user's ability to cancel
        // via leave() (which clears the ticket ref).
        const POLL_INTERVAL_MS = 500;
        const MAX_POLL_MS = 120_000;
        const pollStart = Date.now();
        while (Date.now() - pollStart < MAX_POLL_MS) {
          if (!matchmakingTicketRef.current) break; // user cancelled via leave()
          const matched = await pollMatch("tictactoe", response.ticket);
          if (matched.status === "matched") {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        leaveMatch("tictactoe", response.ticket).catch(() => {});
        matchmakingTicketRef.current = null;
        return;
      }

      if (response.status === "matched") {
        matchmakingTicketRef.current = null;
        joinAsGuest(response.match.roomId, response.match.wsUrl);
        return;
      }
    } catch (err) {
      matchmakingTicketRef.current = null;
      hasStartedRef.current = false;
      update({ status: "error", message: `Matchmaking failed: ${(err as Error).message}` });
    }
  }, [joinAsGuest, options.hostDisplayName, startAsHost, stopTimer, update]);

  const sendMove = useCallback(
    (index: number) => {
      if (state.role === "host") {
        applyHostMove(index, PlayerSymbol.X);
        return;
      }
      if (state.role === "guest") {
        if (USE_WS_ROOM) {
          roomRef.current?.send({ type: "move", index });
        } else {
          const conn = connRef.current;
          if (conn?.open) sendMessage(conn, { type: "move", index });
        }
      }
    },
    [applyHostMove, state.role],
  );

  const requestRematch = useCallback(() => {
    if (USE_WS_ROOM) {
      if (state.role === "guest") {
        roomRef.current?.send({ type: "rematchAccept" });
      } else if (state.role === "host") {
        roomRef.current?.send({ type: "rematchRequested", requesterSymbol: PlayerSymbol.X });
      }
      return;
    }
    const conn = connRef.current;
    if (state.role === "guest" && conn?.open) {
      sendMessage(conn, { type: "rematchAccept" });
    } else if (state.role === "host" && conn?.open) {
      sendMessage(conn, { type: "rematchRequested", requesterSymbol: PlayerSymbol.X });
    }
  }, [state.role]);

  const declineRematch = useCallback(() => {
    if (USE_WS_ROOM) {
      if (state.role === "guest") {
        roomRef.current?.send({ type: "rematchDecline" });
      }
      return;
    }
    const conn = connRef.current;
    if (state.role === "guest" && conn?.open) {
      sendMessage(conn, { type: "rematchDecline" });
    }
  }, [state.role]);

  const leave = useCallback(() => {
    if (USE_WS_ROOM) {
      roomRef.current?.close();
      roomRef.current = null;
    } else {
      const conn = connRef.current;
      if (conn?.open) sendMessage(conn, { type: "leave" });
      conn?.close();
      peerRef.current?.destroy();
    }
    stopTimer();
    const ticket = matchmakingTicketRef.current;
    if (ticket) {
      leaveMatch("tictactoe", ticket).catch(() => {});
      matchmakingTicketRef.current = null;
    }
    hasStartedRef.current = false;
    setState((prev) => ({ ...prev, status: "disconnected", message: "You left" }));
  }, [stopTimer]);

  useEffect(() => {
    if (state.role === "host" && isGameActive(stateRef.current)) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [state.role, state.gameState.gameStatus, state.gameState.winner, startTimer, stopTimer]);

  useEffect(() => () => leave(), [leave]);

  return {
    state,
    startAsHost,
    startQuickMatch,
    joinAsGuest,
    sendMove,
    requestRematch,
    declineRematch,
    leave,
  };
}
