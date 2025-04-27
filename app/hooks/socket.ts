import {
  GameState,
  GameMode,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@/app/types/types";
import { io, Socket } from "socket.io-client";

import {
  PlayerSymbol,
  AI_Difficulty,
  GameStatus,
  GameModes,
  Color,
  Events,
} from "@/app/game/constants/constants";
import { useState, useEffect, useCallback } from "react";

interface UseGameSocketProps {
  username: string;
  selectedColor: Color;
  onMessage: (msg: string) => void;
  onGameStateUpdate: (state: GameState) => void;
  onPlayerSymbolAssigned: (symbol: PlayerSymbol | null) => void;
  onOpponentUpdate: (name: string, color?: Color) => void;
  onRematchState: (offered: boolean, requested: boolean) => void;
}

/**
 * Custom hook for managing socket connection and game socket events
 */
export function useGameSocket({
  username,
  selectedColor,
  onMessage,
  onGameStateUpdate,
  onPlayerSymbolAssigned,
  onOpponentUpdate,
  onRematchState,
}: UseGameSocketProps) {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [lastAssignedColor, setLastAssignedColor] = useState<Color | null>(
    null
  );
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);

  /**
   * Initialize socket connection
   */
  const initializeSocket = useCallback(() => {
    // Prevent multiple initializations
    if (socket?.connected) return;

    // Ensure username is set before connecting
    if (!username.trim()) {
      onMessage("Please enter a username first.");
      return;
    }

    console.log("Attempting to initialize socket connection...");
    onMessage("Connecting to server...");

    // Fetch to ensure the server-side initialization logic runs
    fetch("/api/socket")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API check failed: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.status !== "running" && data.status !== "initializing") {
          throw new Error(`Socket server status: ${data.status || "unknown"}`);
        }

        // Determine Socket URL (use environment variables for production)
        const socketUrl =
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3009";
        console.log("Connecting Socket.IO to:", socketUrl);

        const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> =
          io(socketUrl, {
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
          });

        setSocket(newSocket);
      })
      .catch((err) => {
        console.error("Socket initialization error:", err);
        onMessage(
          `Connection failed: ${err.message}. Ensure server is running.`
        );
        setSocket(null);
      });
  }, [username, socket, onMessage]);

  /**
   * Set up socket event listeners
   */
  useEffect(() => {
    if (!socket) return;

    // --- Connection Handling ---
    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
      onMessage("Connected! Waiting for opponent...");
      // Emit login *after* successful connection
      socket.emit("login", username, selectedColor);
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.log("Socket disconnected:", reason);
      onMessage(`Disconnected: ${reason}. Please log in again.`);
      setPlayerSymbol(null);
      onPlayerSymbolAssigned(null);
      onRematchState(false, false);
    };

    const handleConnectError = (err: Error) => {
      console.error("Socket connection error:", err);
      onMessage(`Connection error: ${err.message}`);
      setSocket(null);
    };

    // --- Game Event Handling ---
    const handlePlayerAssigned = (payload: {
      symbol: PlayerSymbol;
      roomId: string;
      assignedColor: Color;
    }) => {
      console.log("Player assigned:", payload);
      setPlayerSymbol(payload.symbol);
      onPlayerSymbolAssigned(payload.symbol);
      setLastAssignedColor(payload.assignedColor);
    };

    const handleColorChanged = (payload: {
      newColor: Color;
      reason: string;
    }) => {
      console.log("Color changed by server:", payload);
      onMessage(
        `Your color was changed to ${payload.newColor} (${payload.reason})`
      );
      setLastAssignedColor(payload.newColor);
    };

    const handlePlayerJoined = (payload: {
      username: string;
      symbol: PlayerSymbol;
    }) => {
      console.log("Player joined:", payload);
      onMessage(`${payload.username} (${payload.symbol}) joined.`);

      // Update opponent name in state if needed
      if (playerSymbol && payload.symbol !== playerSymbol) {
        onOpponentUpdate(payload.username);
      }
    };

    const handlePlayerLeft = (payload: { symbol: PlayerSymbol | null }) => {
      console.log("Player left:", payload);
      onMessage(`Player ${payload.symbol || "?"} left the game. Waiting...`);
      onOpponentUpdate("");
      onRematchState(false, false);

      // Argument of type '(prevState: GameState) =>
      // { gameStatus: GameStatus; winner: null; board: GameBoard; currentPlayer: PlayerSymbol; players: Record<PlayerSymbol, PlayerConfig>;
      // ... 5 more ...; aiDifficulty?: AI_Difficulty; }'
      // is not assignable to parameter of type 'GameState'.ts(2345)
      onGameStateUpdate((prevState: GameState) => ({
        ...prevState,
        gameStatus: GameStatus.WAITING,
        winner: null,
      }));
    };

    const handleGameStart = (initialGameState: GameState) => {
      console.log("Game start received:", initialGameState);
      onGameStateUpdate(initialGameState);
      onRematchState(false, false);

      onMessage(
        `Game started! ${
          initialGameState.players[initialGameState.currentPlayer]?.username
        }'s turn.`
      );

      // Set opponent name/color from initial state
      if (playerSymbol) {
        const opponentSym =
          playerSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
        const opponentData = initialGameState.players[opponentSym];
        if (opponentData?.username) {
          onOpponentUpdate(opponentData.username, opponentData.color);
        }
      }
    };

    const handleGameUpdate = (updatedGameState: GameState) => {
      console.log("Game update received:", updatedGameState);
      onGameStateUpdate(updatedGameState);
      onRematchState(false, false);

      // Update message based on new state
      if (updatedGameState.winner) {
        onMessage(
          updatedGameState.winner === "draw"
            ? "It's a draw!"
            : `${
                updatedGameState.players[updatedGameState.winner]?.username ||
                `Player ${updatedGameState.winner}`
              } wins!`
        );
      } else {
        onMessage(
          `${
            updatedGameState.players[updatedGameState.currentPlayer]
              ?.username || "Opponent"
          }'s turn.`
        );
      }
    };

    const handleGameReset = (resetGameState: GameState) => {
      console.log("Game reset (rematch accepted):", resetGameState);
      onGameStateUpdate(resetGameState);
      onRematchState(false, false);

      onMessage("Rematch started!");
      setTimeout(
        () =>
          onMessage(
            `${
              resetGameState.players[resetGameState.currentPlayer]?.username
            }'s turn.`
          ),
        1500
      );
    };

    const handleRematchRequested = (payload: {
      requesterSymbol: PlayerSymbol;
    }) => {
      console.log("Rematch requested by:", payload.requesterSymbol);

      // Only show offer if it wasn't this player who requested it
      if (payload.requesterSymbol !== playerSymbol) {
        onRematchState(true, false);
        onMessage(`Opponent wants a rematch!`);
      }
    };

    const handleError = (errorMessage: string) => {
      console.error("Server error received:", errorMessage);

      // Check if the error relates to a declined rematch
      if (errorMessage.toLowerCase().includes("declined the rematch")) {
        onRematchState(false, false);
      }
      onMessage(`Error: ${errorMessage}`);
    };

    // --- Register Listeners ---
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("playerAssigned", handlePlayerAssigned);
    socket.on("colorChanged", handleColorChanged);
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);
    socket.on("gameStart", handleGameStart);
    socket.on("gameUpdate", handleGameUpdate);
    socket.on("gameReset", handleGameReset);
    socket.on("rematchRequested", handleRematchRequested);
    socket.on("error", handleError);

    // --- Cleanup Function ---
    return () => {
      console.log("Cleaning up socket listeners...");
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("playerAssigned", handlePlayerAssigned);
      socket.off("colorChanged", handleColorChanged);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("playerLeft", handlePlayerLeft);
      socket.off("gameStart", handleGameStart);
      socket.off("gameUpdate", handleGameUpdate);
      socket.off("gameReset", handleGameReset);
      socket.off("rematchRequested", handleRematchRequested);
      socket.off("error", handleError);
    };
  }, [
    socket,
    username,
    playerSymbol,
    selectedColor,
    onMessage,
    onGameStateUpdate,
    onPlayerSymbolAssigned,
    onOpponentUpdate,
    onRematchState,
  ]);

  /**
   * Cleanup socket connection
   */
  const disconnectSocket = useCallback(() => {
    if (socket) {
      console.log("Disconnecting socket...");
      if (socket.connected) {
        socket.disconnect();
      }
      setSocket(null);
    }
  }, [socket]);

  /**
   * Make a move in an online game
   */
  const makeMove = useCallback(
    (index: number) => {
      if (socket && socket.connected) {
        socket.emit("move", index);
      } else {
        onMessage("Not connected to server.");
      }
    },
    [socket, onMessage]
  );

  /**
   * Request a rematch
   */
  const requestRematch = useCallback(() => {
    if (socket && socket.connected) {
      console.log("Requesting rematch...");
      socket.emit(Events.REQUEST_REMATCH);
      onRematchState(false, true);
      onMessage("Rematch requested. Waiting for opponent...");
    }
  }, [socket, onMessage, onRematchState]);

  /**
   * Accept a rematch request
   */
  const acceptRematch = useCallback(() => {
    if (socket && socket.connected) {
      console.log("Accepting rematch...");
      socket.emit(Events.ACCEPT_REMATCH);
      onRematchState(false, false);
    }
  }, [socket, onRematchState]);

  /**
   * Decline a rematch request
   */
  const declineRematch = useCallback(() => {
    if (socket && socket.connected) {
      console.log("Declining rematch...");
      socket.emit(Events.DECLINE_REMATCH);
      onRematchState(false, false);
      onMessage("Rematch declined.");
    }
  }, [socket, onMessage, onRematchState]);

  /**
   * Leave the current room
   */
  const leaveRoom = useCallback(() => {
    if (socket && socket.connected) {
      console.log("Leaving room...");
      socket.emit(Events.LEAVE_ROOM);
    }
  }, [socket]);

  /**
   * Reset the game (admin operation)
   */
  const resetGame = useCallback(() => {
    if (socket && socket.connected) {
      socket.emit("reset");
    } else {
      onMessage("Not connected to server.");
    }
  }, [socket, onMessage]);

  return {
    socket,
    playerSymbol,
    lastAssignedColor,
    connected: !!socket?.connected,
    initializeSocket,
    disconnectSocket,
    makeMove,
    requestRematch,
    acceptRematch,
    declineRematch,
    leaveRoom,
    resetGame,
  };
}
