"use client";

import { useEffect, useState } from "react";
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
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "./game/constants/constants";
import DevPanel from "@/components/game/devPanel";
import { createFreshGameState } from "./game/logic/newGameState";
import { CanMakeMove } from "./game/logic/canMakeMove";
import { isAITurn } from "./game/ai/canAI_MakeMove";
import { handleAI_Move } from "./game/ai/handleAI_Move";
import { isValidMove } from "./game/logic/isValidMove";
import { isOnlineGame, isVsComputer } from "./utils/gameModeChecks";
import PageFooter from "@/components/common/pageFooter";
import { initializeSocketConnection } from "./api/initSocketConnection";
import { cleanupSocketConnection } from "./api/cleanSocketConnection";
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

  // Create a proper socket initialization function
  const initializeSocket = () => {
    if (socket) return;

    // First, create a fetch to initialize the socket on the server
    fetch("/api/socket")
      .then(() => {
        // Then connect the client
        const newSocket = io({
          path: "/api/socket",
          addTrailingSlash: false,
        });

        setSocket(newSocket);

        // Once connected, log in
        newSocket.on("connect", () => {
          newSocket.emit("login", username, gameMode);
        });
      })
      .catch((err) => {
        console.error("Socket initialization error:", err);
        setMessage("Failed to connect to game server");
      });
  };

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
      cleanupSocketConnection(gameMode, socket);
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
