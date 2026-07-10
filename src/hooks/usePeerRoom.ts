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
import { findMatch, leaveMatch, type MatchmakingResponse } from "@/lib/matchmaking";

export type PeerRole = "host" | "guest" | null;

export type PeerStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "connected"
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
  const stateRef = useRef<GameState>(initialState.gameState);
  const tickRef = useRef<number | null>(null);
  const matchmakingTicketRef = useRef<string | null>(null);
  const hasStartedRef = useRef(false);

  stateRef.current = state.gameState;

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
    const conn = connRef.current;
    if (conn?.open) sendMessage(conn, { type: "gameUpdate", gameState });
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
        const conn = connRef.current;
        if (actor === PlayerSymbol.O && conn?.open) {
          sendMessage(conn, { type: "error", message: "Invalid move" });
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
        const conn = connRef.current;
        if (conn?.open) {
          sendMessage(conn, {
            type: "joined",
            symbol: guestSymbol,
            color: guestColor,
            gameState: updated,
          });
          sendMessage(conn, { type: "gameStart", gameState: updated });
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

  const startAsHost = useCallback(
      (providedRoomId?: string) => {
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
  }, [handleHostData, options.hostColor, options.hostDisplayName, stopTimer, update]);

  const joinAsGuest = useCallback(
    (roomId: string) => {
      stopTimer();
      const trimmed = roomId.trim();
      if (!trimmed) {
        update({ status: "error", message: "Enter a room ID" });
        return;
      }
      update({ role: "guest", status: "connecting", roomId: trimmed, message: "Connecting..." });
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
          if (isPeerMessage(raw)) {
            const message = raw;
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
            } else if (message.type === "rematchRequested") {
              const state = stateRef.current;
              setState((prev) => ({
                ...prev,
                message: `${state.players[message.requesterSymbol].username} wants a rematch — click Play Again to accept`,
              }));
            } else if (message.type === "error") {
              setState((prev) => ({ ...prev, message: message.message }));
            }
          }
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
    [options.hostColor, options.hostDisplayName, stopTimer, update],
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
        startAsHost(response.roomId);
        return;
      }

      if (response.status === "matched") {
        matchmakingTicketRef.current = null;
        joinAsGuest(response.match.roomId);
        return;
      }
    } catch (err) {
      update({ status: "error", message: `Matchmaking failed: ${(err as Error).message}` });
    }
  }, [joinAsGuest, options.hostDisplayName, startAsHost, stopTimer, update]);

  const sendMove = useCallback(
    (index: number) => {
      if (state.role === "host") {
        applyHostMove(index, PlayerSymbol.X);
        return;
      }
      const conn = connRef.current;
      if (state.role === "guest" && conn?.open) {
        sendMessage(conn, { type: "move", index });
      }
    },
    [applyHostMove, state.role],
  );

  const requestRematch = useCallback(() => {
    const conn = connRef.current;
    if (state.role === "guest" && conn?.open) {
      sendMessage(conn, { type: "rematchAccept" });
    } else if (state.role === "host") {
      const conn2 = connRef.current;
      if (conn2?.open) sendMessage(conn2, { type: "rematchRequested", requesterSymbol: PlayerSymbol.X });
    }
  }, [state.role]);

  const declineRematch = useCallback(() => {
    const conn = connRef.current;
    if (state.role === "guest" && conn?.open) {
      sendMessage(conn, { type: "rematchDecline" });
    }
  }, [state.role]);

  const leave = useCallback(() => {
    const conn = connRef.current;
    if (conn?.open) sendMessage(conn, { type: "leave" });
    conn?.close();
    peerRef.current?.destroy();
    stopTimer();
    const ticket = matchmakingTicketRef.current;
    if (ticket) {
      leaveMatch("tictactoe", ticket);
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
