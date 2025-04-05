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
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
} from "./game/constants/constants";
import DevPanel from "@/components/game/devPanel";
import { createFreshGameState } from "./game/logic/newGameState";
import { CanMakeMove } from "./game/logic/canMakeMove";
import { isAITurn } from "./game/ai/canAI_MakeMove";
import { handleAI_Move } from "./game/ai/handleAI_Move";
import { isValidMove } from "./game/logic/isValidMove";
import { isVsComputer } from "./utils/gameModeChecks";
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

        setSocket(newSocket); // Set socket state immediately
      })
      .catch((err) => {
        console.error("Socket initialization error:", err);
        setMessage(
          `Connection failed: ${err.message}. Ensure server is running.`
        );
        setSocket(null); // Ensure socket is null on failure
      });
  }, [username, socket]); // Dependency: username, socket instance

  // OLD
  // // Create a proper socket initialization function
  // // For App Router - socket client initialization
  // const initializeSocket = () => {
  //   if (socket) return;

  //   // For App Router, we need to connect directly to the port we defined
  //   const socketUrl = "http://localhost:3009";
  //   // // How do i use nodeENV? - /io idk about that...
  //   // const socketUrl =
  //   //   process.env.NODE_ENV === "production"
  //   //     ? `${window.location.origin}/api/socket/io`
  //   //     : "http://localhost:3009/api/socket/io"; // Match the path in GameServer

  //   // First, initialize the socket API
  //   fetch("/api/socket")
  //     .then(() => {
  //       // Connect directly (no path needed when using a separate port)
  //       const newSocket = io(socketUrl);

  //       console.log("Socket connecting to:", socketUrl);

  //       newSocket.on("connect", () => {
  //         console.log("Socket connected successfully", newSocket.id);
  //         newSocket.emit("login", username, gameMode);
  //       });

  //       newSocket.on("connect_error", (err) => {
  //         console.error("Socket connection error:", err);
  //         setMessage(`Connection error: ${err.message}`);
  //       });

  //       setSocket(newSocket);
  //     })
  //     .catch((err) => {
  //       console.error("Socket fetch initialization error:", err);
  //       setMessage("Failed to connect to game server");
  //     });
  // };

  useEffect(() => {
    if (!socket) return;

    // Listen for player symbol assignment
    socket.on("playerAssigned", (symbol) => {
      setPlayerSymbol(symbol);
    });

    // Listen for game updates
    socket.on("updateGame", (newGameState) => {
      setGameState(newGameState);
      // For computer games, always be X
      if (isVsComputer(newGameState) && playerSymbol !== PlayerSymbol.X) {
        setPlayerSymbol(PlayerSymbol.X);
      }
    });

    // Listen for player join events
    socket.on("playerJoined", (playerInfo) => {
      setMessage(`${playerInfo.username} joined as ${playerInfo.type}`);
      setTimeout(() => setMessage(""), 3000);
    });

    // Listen for game reset
    socket.on("gameReset", () => {
      setMessage("Game has been reset");
      setTimeout(() => setMessage(""), 3000);
    });

    // Listen for errors
    socket.on("error", (errorMessage) => {
      setMessage(errorMessage);
      setTimeout(() => setMessage(""), 3000);
    });

    // Clean up listeners when component unmounts or socket changes
    return () => {
      socket.off("playerAssigned");
      socket.off("updateGame");
      socket.off("playerJoined");
      socket.off("gameReset");
      socket.off("error");
    };
  }, [socket, playerSymbol]);

  // ----- COMPUTER MOVES ----- //
  useEffect(() => {
    if (isAITurn(gameState)) {
      return handleAI_Move(gameState, setGameState);
    }
  }, [gameState]);

  // ----- USER LOGIN ----- //
  const handleLogin = () => {
    if (!username.trim()) return;

    if (gameMode === GameModes.ONLINE) {
      initializeSocket();

      // initializeSocketConnection(username, gameMode, socket, setSocket);
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
    if (!isValidMove(gameState, index, loggedIn)) return;

    if (CanMakeMove(gameMode, gameState.currentPlayer, playerSymbol)) {
      if (socket && socket.connected && gameMode === GameModes.ONLINE) {
        socket.emit("move", index);
      } else {
        const newState = makeMove(gameState, index);
        setGameState(newState);
      }
    } else {
      setMessage("It's not your turn");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  // ----- RESET GAME ----- //
  const resetGame = () => {
    if (socket && socket.connected && gameMode === GameModes.ONLINE) {
      socket.emit("resetGame");
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

    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4
        bg-[image:var(--gradient-light)]
        dark:bg-[image:var(--gradient-dark-9)]"
    >
      <h1 className="text-4xl font-bold text-background">Tic Tac Toe</h1>
      <UserMenu
        username={username}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
      />
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
        />
      )}
      <DevPanel gameState={gameState} username={username} socket={socket} />

      <PageFooter />
    </div>
  );
}
