import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  TURN_DURATION_MS,
} from "@/game/constants";
import {
  GameState,
  createInitialGameState,
  freshGameState,
  isGameActive,
  isValidMove,
  makeMove,
  makeRandomMove,
} from "@/game/logic";
import {
  PeerMessage,
  createGuestPeer,
  createHostPeer,
  generateRoomId,
  sendMessage,
} from "@/lib/peer";

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

  const startTimer = useCallback(() => {
    stopTimer();
    tickRef.current = window.setInterval(() => {
      setState((prev) => {
        if (prev.gameState.winner !== null) {
          if (tickRef.current !== null) {
            window.clearInterval(tickRef.current);
            tickRef.current = null;
          }
          return prev;
        }
        const next = { ...prev.gameState, turnTimeRemaining: prev.gameState.turnTimeRemaining ?? TURN_DURATION_MS };
        const remaining = (next.turnTimeRemaining ?? TURN_DURATION_MS) - 1000;
        if (remaining <= 0) {
          const random = makeRandomMove(prev.gameState.board);
          if (random === null) return prev;
          const updated = makeMove(prev.gameState, random);
          if (updated) {
            return {
              ...prev,
              gameState: { ...updated, turnTimeRemaining: TURN_DURATION_MS },
              message: `${prev.gameState.players[prev.gameState.currentPlayer].username || "Player"} ran out of time`,
            };
          }
          return prev;
        }
        return { ...prev, gameState: { ...next, turnTimeRemaining: remaining } };
      });
    }, 1000);
  }, [stopTimer]);

  const broadcastGameState = useCallback(() => {
    const conn = connRef.current;
    if (conn?.open) sendMessage(conn, { type: "gameUpdate", gameState: stateRef.current });
  }, []);

  const applyHostMove = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (!isValidMove(current, index, current.currentPlayer)) {
        const conn = connRef.current;
        if (conn?.open) sendMessage(conn, { type: "error", message: "Invalid move" });
        return;
      }
      const next = makeMove(current, index);
      if (!next) return;
      stateRef.current = { ...next, turnTimeRemaining: TURN_DURATION_MS };
      setState((prev) => ({ ...prev, gameState: stateRef.current }));
      broadcastGameState();
    },
    [broadcastGameState],
  );

  const handleHostData = useCallback(
    (message: PeerMessage) => {
      if (message.type === "join") {
        const state = stateRef.current;
        const guestSymbol = state.players[PlayerSymbol.X]?.isActive
          ? PlayerSymbol.O
          : PlayerSymbol.X;
        const guestColor = sanitizeColor(undefined);
        const updated: GameState = {
          ...state,
          gameStatus: GameStatus.ACTIVE,
          players: {
            ...state.players,
            [guestSymbol]: {
              username: message.displayName,
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
          guestDisplayName: message.displayName,
          guestSymbol: guestSymbol,
          gameState: updated,
          message: "",
        }));
        return;
      }
      if (message.type === "move") {
        applyHostMove(message.index);
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
        stateRef.current = reset;
        setState((prev) => ({ ...prev, gameState: reset }));
        const conn = connRef.current;
        if (conn?.open) sendMessage(conn, { type: "gameUpdate", gameState: reset });
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
          winner: state.currentPlayer === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X,
          gameStatus: GameStatus.COMPLETED,
        };
        stateRef.current = ended;
        setState((prev) => ({ ...prev, gameState: ended, message: "Opponent left" }));
        return;
      }
    },
    [applyHostMove, broadcastGameState, stopTimer],
  );

  const startAsHost = useCallback(() => {
    stopTimer();
    const roomId = generateRoomId();
    update({ role: "host", status: "creating", roomId, message: "" });
    const peer = createHostPeer(roomId);
    peerRef.current = peer;
    peer.on("open", () => {
      update({ status: "waiting", message: `Room ${roomId} — waiting for opponent` });
    });
    peer.on("connection", (conn) => {
      connRef.current = conn;
      conn.on("open", () => {
        update({ status: "connecting" });
      });
      conn.on("data", (raw) => {
        if (raw && typeof raw === "object" && "type" in (raw as PeerMessage)) {
          handleHostData(raw as PeerMessage);
        }
      });
      conn.on("close", () => {
        stopTimer();
        setState((prev) => ({ ...prev, status: "disconnected", message: "Opponent disconnected" }));
      });
      conn.on("error", (err) => {
        update({ status: "error", message: `Connection error: ${(err as Error).message}` });
      });
    });
    peer.on("error", (err) => {
      update({ status: "error", message: `Peer error: ${(err as Error).message}` });
    });
  }, [handleHostData, stopTimer, update]);

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
          setState((prev) => ({ ...prev, status: "connected" }));
        });
        conn.on("data", (raw) => {
          if (raw && typeof raw === "object" && "type" in (raw as PeerMessage)) {
            const message = raw as PeerMessage;
            if (message.type === "joined" || message.type === "gameStart" || message.type === "gameUpdate") {
              stateRef.current = message.gameState;
              setState((prev) => {
                const localSymbol =
                  message.type === "joined" && message.symbol
                    ? message.symbol
                    : prev.guestSymbol;
                return {
                  ...prev,
                  gameState: message.gameState,
                  guestSymbol: localSymbol,
                  message: "",
                };
              });
            } else if (message.type === "rematchRequested") {
              const state = stateRef.current;
              setState((prev) => ({
                ...prev,
                message: `${state.players[message.requesterSymbol].username} wants a rematch`,
              }));
            } else if (message.type === "error") {
              setState((prev) => ({ ...prev, message: message.message }));
            }
          }
        });
        conn.on("close", () => {
          stopTimer();
          setState((prev) => ({ ...prev, status: "disconnected", message: "Host disconnected" }));
        });
        conn.on("error", (err) => {
          update({ status: "error", message: `Connection error: ${(err as Error).message}` });
        });
      });
      peer.on("error", (err) => {
        update({ status: "error", message: `Peer error: ${(err as Error).message}` });
      });
    },
    [options.hostColor, options.hostDisplayName, stopTimer, update],
  );

  const sendMove = useCallback(
    (index: number) => {
      if (state.role === "host") {
        applyHostMove(index);
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
    setState((prev) => ({ ...prev, status: "disconnected", message: "You left" }));
  }, [stopTimer]);

  useEffect(() => {
    if (isGameActive(stateRef.current)) {
      startTimer();
    }
    return () => stopTimer();
  }, [state.gameState.gameStatus, state.gameState.winner, startTimer, stopTimer]);

  useEffect(
    () => () => {
      stopTimer();
      connRef.current?.close();
      peerRef.current?.destroy();
    },
    [stopTimer],
  );

  return {
    state,
    startAsHost,
    joinAsGuest,
    sendMove,
    requestRematch,
    declineRematch,
    leave,
  };
}
