"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  GameState,
  ServerToClientEvents,
} from "@/app/types/types";
import {
  Color,
  Events,
  GameStatus,
  PlayerSymbol,
} from "@/app/game/constants/constants";

interface SocketLoginOptions {
  username?: string;
  color?: Color;
}

export const useSocketGame = (
  username: string,
  selectedColor: Color,
  playerSymbol: PlayerSymbol | null,
  setPlayerSymbol: (symbol: PlayerSymbol | null) => void,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  setOpponentName: (name: string) => void,
  setOpponentColor: (color: Color) => void,
  setSelectedColor: (color: Color) => void,
  setMessage: (msg: string) => void,
  setLoggedIn: (loggedIn: boolean) => void,
  setRematchOffered: (offered: boolean) => void,
  setRematchRequested: (requested: boolean) => void,
  exitGame: () => void
) => {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);

  // Refs to avoid stale closures in socket handlers
  const usernameRef = useRef(username);
  const selectedColorRef = useRef(selectedColor);
  const playerSymbolRef = useRef(playerSymbol);

  useEffect(() => {
    usernameRef.current = username;
    selectedColorRef.current = selectedColor;
    playerSymbolRef.current = playerSymbol;
  }, [username, selectedColor, playerSymbol]);

  const initializeSocket = useCallback((options: SocketLoginOptions = {}) => {
    if (socket?.connected) return true;

    const loginUsername = options.username ?? usernameRef.current;
    const loginColor = options.color ?? selectedColorRef.current;

    if (!loginUsername.trim()) {
      setMessage("Please enter a username first.");
      return false;
    }

    usernameRef.current = loginUsername.trim();
    selectedColorRef.current = loginColor;
    setMessage("Connecting to server...");

    let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    
    if (!socketUrl && typeof window !== "undefined") {
      socketUrl = window.location.origin;
    }
    
    if (!socketUrl) socketUrl = "http://localhost:3000";

    try {
      const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        transports: ["websocket", "polling"], // Ensure multiple transports
      });
      setSocket(newSocket);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Socket connection error:", err);
      setMessage(`Connection failed: ${message}`);
      setSocket(null);
      return false;
    }
  }, [socket, setMessage]);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setMessage("Connected! Waiting for opponent...");
      socket.emit("login", usernameRef.current, selectedColorRef.current);
    };

    const handleDisconnect = (reason: string) => {
      setMessage(`Disconnected: ${reason}. Please log in again.`);
      setPlayerSymbol(null);
      setLoggedIn(false);
      setRematchOffered(false);
      setRematchRequested(false);
    };

    const handlePlayerAssigned = (payload: { symbol: PlayerSymbol; roomId: string; assignedColor: Color }) => {
      setPlayerSymbol(payload.symbol);
      setSelectedColor(payload.assignedColor);
    };

    const handleGameStart = (initialGameState: GameState) => {
      setGameState(initialGameState);
      setRematchOffered(false);
      setRematchRequested(false);
      const selfSymbol = playerSymbolRef.current;
      if (selfSymbol) {
        const opponentSym = selfSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
        const opponentData = initialGameState.players[opponentSym];
        if (opponentData?.username) {
          setOpponentName(opponentData.username);
          setOpponentColor(opponentData.color);
        }
      }
    };

    const handleGameUpdate = (updatedGameState: GameState) => {
      setGameState(updatedGameState);
      if (updatedGameState.winner) {
        setMessage(`${updatedGameState.players[updatedGameState.winner]?.username || "Opponent"} wins!`);
      } else {
        setMessage(`${updatedGameState.players[updatedGameState.currentPlayer]?.username || "Opponent"}'s turn.`);
      }
    };

    const handleRematchRequested = (payload: { requesterSymbol: PlayerSymbol }) => {
      if (payload.requesterSymbol !== playerSymbolRef.current) {
        setRematchOffered(true);
        setMessage("Opponent wants a rematch!");
      }
    };

    const handleColorChanged = (payload: { newColor: Color; reason: string }) => {
      setSelectedColor(payload.newColor);
      setMessage(payload.reason);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("playerAssigned", handlePlayerAssigned);
    socket.on("gameStart", handleGameStart);
    socket.on("gameUpdate", handleGameUpdate);
    socket.on("rematchRequested", handleRematchRequested);
    socket.on("colorChanged", handleColorChanged);
    socket.on("gameReset", handleGameStart);
    socket.on("playerLeft", (payload) => {
      setMessage("Opponent left. Waiting...");
      if (payload.gameState) {
        setGameState(payload.gameState);
      } else {
        setGameState(prev => ({ ...prev, gameStatus: GameStatus.WAITING, winner: null }));
      }
      setRematchOffered(false);
      setRematchRequested(false);
    });
    socket.on("error", (err) => setMessage(`Error: ${err}`));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playerAssigned");
      socket.off("gameStart");
      socket.off("gameUpdate");
      socket.off("rematchRequested");
      socket.off("colorChanged");
      socket.off("gameReset");
      socket.off("playerLeft");
      socket.off("error");
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [socket, setGameState, setLoggedIn, setMessage, setOpponentColor, setOpponentName, setPlayerSymbol, setRematchOffered, setRematchRequested, setSelectedColor]);

  const handleSocketMove = useCallback((index: number) => {
    if (!socket || !socket.connected) return;
    socket.emit("move", index);
  }, [socket]);

  const requestRematch = useCallback(() => {
    if (socket) socket.emit(Events.REQUEST_REMATCH);
  }, [socket]);

  const acceptRematch = useCallback(() => {
    if (socket) socket.emit(Events.ACCEPT_REMATCH);
  }, [socket]);

  const declineRematch = useCallback(() => {
    if (socket) socket.emit(Events.DECLINE_REMATCH);
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (socket) socket.emit(Events.LEAVE_ROOM);
    exitGame();
  }, [socket, exitGame]);

  const resetSocketGame = useCallback(() => {
    if (socket) socket.emit("reset");
  }, [socket]);

  return {
    socket,
    initializeSocket,
    handleSocketMove,
    requestRematch,
    acceptRematch,
    declineRematch,
    leaveRoom,
    resetSocketGame
  };
};
