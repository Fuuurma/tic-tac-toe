"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClientToServerEvents,
  GameMode,
  GameState,
  initialGameState,
  ServerToClientEvents,
} from "./types/types";
import { io, Socket } from "socket.io-client";

import { makeMove } from "./game/logic/makeMove";
import LoginForm from "@/components/auth/loginForm";
import GameBoard from "@/components/game/board";
import UserMenu from "@/components/menu/menu";
import {
  Color,
  Events,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "./game/constants/constants";
import DevPanel from "@/components/game/devPanel";
import { createFreshGameState } from "./game/logic/newGameState";
import { CanMakeMove } from "./game/logic/canMakeMove";
import { isAITurn } from "./game/ai/canAI_MakeMove";
import { handleAI_Move } from "./game/ai/handleAI_Move";
import { isValidMove } from "./game/logic/isValidMove";
import PageFooter from "@/components/common/pageFooter";
import { createInitialGameState } from "./game/logic/createInitialGameState";

export default function Home() {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [username, setUsername] = useState<string>("");
  const [opponentName, setOpponentName] = useState<string>("");

  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [message, setMessage] = useState<string>("");
  const [gameMode, setGameMode] = useState<GameMode>(GameModes.VS_COMPUTER);
  const [selectedColor, setSelectedColor] = useState<Color>(
    PLAYER_CONFIG[PlayerSymbol.X].defaultColor
  );
  const [opponentColor, setOpponentColor] = useState<Color>(
    PLAYER_CONFIG[PlayerSymbol.O].defaultColor
  );

  const [rematchOffered, setRematchOffered] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [lastAssignedColor, setLastAssignedColor] = useState<Color | null>(
    null
  ); // Track assigned color - Maybe it works with selectedColor ¿?

  // ----- SOCKET ----- //

  const initializeSocket = useCallback(() => {
    // Prevent multiple initializations
    if (socket?.connected) return;

    // Ensure username is set before connecting
    if (!username.trim()) {
      setMessage("Please enter a username first.");
      return;
    }

    console.log("Attempting to initialize socket connection...");
    setMessage("Connecting to server...");

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
          // Check status from API
          throw new Error(`Socket server status: ${data.status || "unknown"}`);
        }

        // Determine Socket URL (use environment variables for production)
        const socketUrl =
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3009";
        console.log("Connecting Socket.IO to:", socketUrl);

        const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> =
          io(socketUrl, {
            // Optional: Add reconnection attempts, timeouts etc.
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            // Add query params if needed for auth, etc. (though login event is better)
            // query: { username }
          });

        setSocket(newSocket);
      })
      .catch((err) => {
        console.error("Socket initialization error:", err);
        setMessage(
          `Connection failed: ${err.message}. Ensure server is running.`
        );
        setSocket(null);
      });
  }, [username, socket]); // Dependency: username, socket instance

  // ----- SOCKET EVENT LISTENERS ----- //
  useEffect(() => {
    if (!socket) return;

    // --- Connection Handling ---
    const handleConnect = () => {
      console.log("Socket connected:", socket.id);
      setMessage("Connected! Waiting for opponent...");
      // Emit login *after* successful connection
      socket.emit("login", username, selectedColor); // Send username and preferred color
    };

    const handleDisconnect = (reason: Socket.DisconnectReason) => {
      console.log("Socket disconnected:", reason);
      setMessage(`Disconnected: ${reason}. Please log in again.`);
      setPlayerSymbol(null);
      setLoggedIn(false); // Force logout on disconnect
      setRematchOffered(false); // Reset rematch state
      setRematchRequested(false);
    };

    const handleConnectError = (err: Error) => {
      console.error("Socket connection error:", err);
      setMessage(`Connection error: ${err.message}`);
      setSocket(null);
    };

    // --- Game Event Handling ---
    const handlePlayerAssigned = (payload: {
      symbol: PlayerSymbol;
      roomId: string;
      assignedColor: Color;
    }) => {
      // Added assignedColor
      console.log("Player assigned:", payload);
      setPlayerSymbol(payload.symbol);
      setLastAssignedColor(payload.assignedColor); // Store the color assigned by server
      // Update local color state if different from selectedColor (though server state is king)
      if (
        selectedColor !== payload.assignedColor &&
        payload.symbol === PlayerSymbol.X
      ) {
        // Assuming X is 'self' initially
        setSelectedColor(payload.assignedColor);
      } else if (
        opponentColor !== payload.assignedColor &&
        payload.symbol === PlayerSymbol.O
      ) {
        // Assuming O is opponent
        setOpponentColor(payload.assignedColor);
      }
    };

    const handleColorChanged = (payload: {
      newColor: Color;
      reason: string;
    }) => {
      console.log("Color changed by server:", payload);
      setMessage(
        `Your color was changed to ${payload.newColor} (${payload.reason})`
      );
      setLastAssignedColor(payload.newColor); // Update stored color
      // Update the primary color state based on current playerSymbol
      if (playerSymbol) {
        if (playerSymbol === PlayerSymbol.X) setSelectedColor(payload.newColor);
        // No easy way to know opponent symbol here, rely on gameUpdate/Start
      }
      // Optionally update opponentColor if logic allows determination
    };

    const handlePlayerJoined = (payload: {
      username: string;
      symbol: PlayerSymbol;
    }) => {
      console.log("Player joined:", payload);
      setMessage(`${payload.username} (${payload.symbol}) joined.`);
      // Update opponent name in state if needed
      if (playerSymbol && payload.symbol !== playerSymbol) {
        setOpponentName(payload.username);
      }
      // Don't clear message immediately, wait for game start or update
    };

    const handlePlayerLeft = (payload: { symbol: PlayerSymbol | null }) => {
      console.log("Player left:", payload);
      setMessage(`Player ${payload.symbol || "?"} left the game. Waiting...`);
      setOpponentName("");
      setRematchOffered(false); // Reset rematch state
      setRematchRequested(false);
      setGameState((prev) => ({
        ...prev,
        gameStatus: GameStatus.WAITING, // Set state to waiting
        winner: null,
        // Reset opponent details in players state? Or rely on gameUpdate?
        // Let's rely on gameUpdate from server for consistency
      }));
    };

    const handleGameStart = (initialGameState: GameState) => {
      console.log("Game start received:", initialGameState);
      setGameState(initialGameState);
      setRematchOffered(false); // Reset rematch state on new game
      setRematchRequested(false);
      setMessage(
        `Game started! ${
          initialGameState.players[initialGameState.currentPlayer]?.username
        }'s turn.`
      );
      // Set opponent name/color from initial state
      const selfSymbol = playerSymbol; // Get current player's symbol
      if (selfSymbol) {
        const opponentSym =
          selfSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
        const opponentData = initialGameState.players[opponentSym];
        if (opponentData?.username) {
          setOpponentName(opponentData.username);
          setOpponentColor(opponentData.color); // Set opponent color from state
        }
        // Ensure self color matches game state (in case COLOR_CHANGED wasn't processed before game start)
        if (initialGameState.players[selfSymbol]?.color) {
          setSelectedColor(initialGameState.players[selfSymbol].color);
        }
      }
    };

    const handleGameUpdate = (updatedGameState: GameState) => {
      console.log("Game update received:", updatedGameState);
      setGameState(updatedGameState);
      setRematchOffered(false); // Reset rematch state if game somehow updates during request
      setRematchRequested(false);
      // Update message based on new state
      if (updatedGameState.winner) {
        setMessage(
          updatedGameState.winner === "draw"
            ? "It's a draw!"
            : `${
                updatedGameState.players[updatedGameState.winner]?.username ||
                `Player ${updatedGameState.winner}`
              } wins!`
        );
        // Game is now completed, UI should allow rematch options
      } else {
        setMessage(
          `${
            updatedGameState.players[updatedGameState.currentPlayer]
              ?.username || "Opponent"
          }'s turn.`
        );
      }
    };

    const handleGameReset = (resetGameState: GameState) => {
      console.log("Game reset (rematch accepted):", resetGameState);
      setGameState(resetGameState);
      setRematchOffered(false); // Reset rematch flags
      setRematchRequested(false);
      setMessage("Rematch started!");
      setTimeout(
        () =>
          setMessage(
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
        setRematchOffered(true);
        setMessage(`${opponentName || "Opponent"} wants a rematch!`);
      }
    };

    const handleError = (errorMessage: string) => {
      console.error("Server error received:", errorMessage);
      // Check if the error relates to a declined rematch
      if (errorMessage.toLowerCase().includes("declined the rematch")) {
        setRematchRequested(false); // Allow requesting again
      }
      setMessage(`Error: ${errorMessage}`);
    };

    // --- Register Listeners ---
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("playerAssigned", handlePlayerAssigned);
    socket.on("colorChanged", handleColorChanged); // Listen for color changes
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);
    socket.on("gameStart", handleGameStart);
    socket.on("gameUpdate", handleGameUpdate);
    socket.on("gameReset", handleGameReset);
    socket.on("rematchRequested", handleRematchRequested); // Listen for rematch offers
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
    // Dependencies need review - ensure all state used inside handlers that should trigger re-binding is listed
  }, [socket, username, playerSymbol, selectedColor, opponentName]); // Added opponentName

  // online click handlers

  const handleRequestRematchClick = () => {
    if (socket && gameState.gameStatus === GameStatus.COMPLETED) {
      console.log("Requesting rematch...");
      socket.emit(Events.REQUEST_REMATCH);
      setRematchRequested(true); // Update own state
      setMessage("Rematch requested. Waiting for opponent...");
    }
  };

  const handleAcceptRematchClick = () => {
    if (socket && rematchOffered) {
      console.log("Accepting rematch...");
      socket.emit(Events.ACCEPT_REMATCH);
      setRematchOffered(false); // Clear offer state
      // Game state will be updated by server via gameReset event
    }
  };

  const handleDeclineRematchClick = () => {
    if (socket && rematchOffered) {
      console.log("Declining rematch...");
      socket.emit(Events.DECLINE_REMATCH);
      setRematchOffered(false); // Clear offer state
      setMessage("Rematch declined.");
      // Consider automatically leaving or letting user click Leave Room separately
      // handleLeaveRoomClick(); // Option: leave immediately after declining
    }
  };

  const handleLeaveRoomClick = () => {
    if (socket) {
      console.log("Leaving room...");
      socket.emit(Events.LEAVE_ROOM);
    }
    exitGame(); // Call existing exit function to clean up client state/disconnect
  };

  // ----- COMPUTER MOVES ----- //
  useEffect(() => {
    if (isAITurn(gameState)) {
      return handleAI_Move(gameState, setGameState);
    }
  }, [gameState]);

  // ----- USER LOGIN ----- //
  const handleLogin = () => {
    if (!username.trim()) {
      setMessage("Please enter a username.");
      return;
    }

    if (gameMode === GameModes.ONLINE) {
      // Initialize socket connection (will emit login on connect)
      initializeSocket();
      setLoggedIn(true); // Set loggedIn immediately for UI change
      setMessage("Connecting...");
    } else {
      // cleanupSocketConnection(gameMode, socket);
      setGameState(
        createInitialGameState(username, gameMode, {
          opponentName,
          playerColor: selectedColor,
          opponentColor,
        })
      );
      setPlayerSymbol(PlayerSymbol.X);

      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }

    setLoggedIn(true);
  };

  // ----- USER MOVES ----- //
  const handleCellClick = (index: number) => {
    if (!loggedIn) return;

    // ONLINE
    if (gameMode === GameModes.ONLINE) {
      if (!socket || !socket.connected) {
        setMessage("Not connected to server.");
        return;
      }
      if (playerSymbol !== gameState.currentPlayer) {
        setMessage("It's not your turn.");
        return;
      }
      if (gameState.board[index] !== null || gameState.winner) {
        setMessage("Invalid move.");
        return;
      }
      // If all checks pass, emit the move
      socket.emit("move", index);
    }
    // LOCAL
    else {
      if (!isValidMove(gameState, index, loggedIn)) return;

      if (CanMakeMove(gameMode, gameState.currentPlayer, playerSymbol)) {
        const newState = makeMove(gameState, index);
        setGameState(newState);
      } else {
        setMessage("It's not your turn");
        setTimeout(() => setMessage(""), 2000);
      }
    }
  };

  // ----- RESET GAME ----- //
  const resetGame = () => {
    if (gameMode === GameModes.ONLINE) {
      if (socket && socket.connected) {
        // Optional: Add confirmation dialog?
        socket.emit("reset"); // Emit 'reset'
      } else {
        setMessage("Not connected to server.");
      }
    } else {
      setGameState(
        createInitialGameState(username, gameMode, {
          opponentName,
          playerColor: selectedColor,
          opponentColor,
        })
      );
    }
  };

  // ----- EXIT GAME ----- //
  const exitGame = () => {
    setLoggedIn(false);
    setGameState(createFreshGameState());
    setPlayerSymbol(null);
    setMessage("");
    setOpponentName("");
    setRematchOffered(false); // Reset rematch flags
    setRematchRequested(false);
    setLastAssignedColor(null);

    if (socket) {
      console.log("Disconnecting socket on exit...");
      // Check if already disconnected before calling disconnect
      if (socket.connected) {
        socket.disconnect();
      }
      setSocket(null); // Clear socket state
    }
  };

  const isGameOver = gameState.gameStatus === GameStatus.COMPLETED;

  return (
    <div
      className="h-screen flex flex-col items-center p-4 gap-4 
    bg-[image:var(--gradient-light)] dark:bg-[image:var(--gradient-dark-9)]
    overflow-y-auto" // Controlled scrolling
    >
      <header className="w-full max-w-4xl flex justify-between items-center mb-4">
        <h1 className="text-4xl font-bold text-background">Tic Tac Toe</h1>
        <UserMenu
          username={username}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
        />
      </header>
      <main className="w-full max-w-4xl flex-1 flex flex-col items-center justify-center">
        {!loggedIn ? (
          <LoginForm
            username={username}
            setUsername={setUsername}
            gameMode={gameMode}
            setGameMode={setGameMode}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            handleLogin={handleLogin}
            opponentName={opponentName}
            setOpponentName={setOpponentName}
            opponentColor={opponentColor}
            setOpponentColor={setOpponentColor}
          />
        ) : (
          <GameBoard
            gameState={gameState}
            message={message}
            handleCellClick={handleCellClick}
            resetGame={resetGame}
            exitGame={exitGame}
            isGameOver={isGameOver}
            rematchOffered={rematchOffered}
            rematchRequested={rematchRequested}
            onRequestRematch={handleRequestRematchClick}
            onAcceptRematch={handleAcceptRematchClick}
            onDeclineRematch={handleDeclineRematchClick}
            onLeaveRoom={handleLeaveRoomClick}
          />
        )}
      </main>
      {/* <DevPanel gameState={gameState} username={username} socket={socket} /> */}

      <PageFooter />
    </div>
  );
}
