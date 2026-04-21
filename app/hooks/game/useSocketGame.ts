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

  const initializeSocket = useCallback(() => {
    if (socket?.connected) return;

    if (!usernameRef.current.trim()) {
      setMessage("Please enter a username first.");
      return;
    }

    setMessage("Connecting to server...");

    let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    
    if (!socketUrl && typeof window !== "undefined") {
      // In development, if no env var is set, try to use the current origin
      // server.js hosts both Next.js and Socket.IO on the same port
      socketUrl = window.location.origin.replace(":3000", ":3000"); // Ensure it's 3000 if not specified
    }
    
    if (!socketUrl) socketUrl = "http://localhost:3000";

    console.log("Connecting to Socket.IO server at:", socketUrl);

    try {
      const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        transports: ["websocket", "polling"], // Ensure multiple transports
      });
      setSocket(newSocket);
    } catch (err: any) {
      console.error("Socket connection error:", err);
      setMessage(`Connection failed: ${err.message}`);
      setSocket(null);
    }
  }, [username, socket, setMessage]);

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
      if (payload.symbol === PlayerSymbol.X) setSelectedColor(payload.assignedColor);
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
      if (updatedGameState.winner && updatedGameState.winner !== "draw") {
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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("playerAssigned", handlePlayerAssigned);
    socket.on("gameStart", handleGameStart);
    socket.on("gameUpdate", handleGameUpdate);
    socket.on("rematchRequested", handleRematchRequested);
    socket.on("gameReset", handleGameStart);
    socket.on("playerLeft", () => {
      setMessage("Opponent left. Waiting...");
      setGameState(prev => ({ ...prev, gameStatus: GameStatus.WAITING, winner: null }));
    });
    socket.on("error", (err) => setMessage(`Error: ${err}`));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playerAssigned");
      socket.off("gameStart");
      socket.off("gameUpdate");
      socket.off("rematchRequested");
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
