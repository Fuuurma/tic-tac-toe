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

import { computerMove } from "./game/ai/logic";
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

  useEffect(() => {
    const newSocket = io() as Socket<
      ServerToClientEvents,
      ClientToServerEvents
    >;
    setSocket(newSocket);

    // Listen for game updates
    newSocket.on("updateGame", (newGameState) => {
      setGameState(newGameState);
      setPlayerSymbol((prev) => {
        // If we're playing against computer, always set as X
        if (newGameState.gameMode === GameModes.VS_COMPUTER) {
          return PlayerSymbol.X;
        }
        return prev;
      });
    });

    // Listen for player join events
    newSocket.on("playerJoined", (playerInfo) => {
      setMessage(`${playerInfo.username} joined as ${playerInfo.type}`);
      setTimeout(() => setMessage(""), 3000);
    });

    // Listen for game reset
    newSocket.on("gameReset", () => {
      setMessage("Game has been reset");
      setTimeout(() => setMessage(""), 3000);
    });

    // Listen for errors
    newSocket.on("error", (errorMessage) => {
      setMessage(errorMessage);
      setTimeout(() => setMessage(""), 3000);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Effect for computer moves
  useEffect(() => {
    // If it's a computer game and computer's turn
    if (
      gameState.gameMode === GameModes.VS_COMPUTER &&
      gameState.currentPlayer === PlayerSymbol.O &&
      !gameState.winner &&
      gameState.gameStatus === GameStatus.ACTIVE
    ) {
      // Add a slight delay to make it feel more natural
      const timer = setTimeout(() => {
        const newState = computerMove(gameState);
        // Only update if playing locally, otherwise server handles it
        if (!socket || !socket.connected) {
          setGameState(newState);
        } else {
          // In case of online play, tell server the computer moved
          socket.emit(
            "move",
            newState.moves[PlayerSymbol.O][
              newState.moves[PlayerSymbol.O].length - 1
            ]
          );
        }
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [gameState, socket]);

  // User login
  const handleLogin = () => {
    if (username.trim()) {
      if (socket && socket.connected && gameMode === GameModes.ONLINE) {
        socket.emit("login", username, gameMode);
      } else {
        // Setup for local play
        const updatedGameState = { ...initialGameState };

        // Update player X (human player)
        updatedGameState.players[PlayerSymbol.X] = {
          username: username,
          color: selectedColor,
          symbol: PlayerSymbol.X,
          type: PlayerTypes.HUMAN,
          isActive: true,
        };

        // Setup player O based on game mode
        if (gameMode === GameModes.VS_COMPUTER) {
          updatedGameState.players[PlayerSymbol.O] = {
            username: "Computer",
            color: opponentColor,
            symbol: PlayerSymbol.O,
            type: PlayerTypes.COMPUTER,
            isActive: false,
          };
        } else if (gameMode === GameModes.VS_FRIEND) {
          updatedGameState.players[PlayerSymbol.O] = {
            username: opponentName || "Player 2",
            color: opponentColor,
            symbol: PlayerSymbol.O,
            type: PlayerTypes.HUMAN,
            isActive: false,
          };
        }

        // Set game mode and status
        updatedGameState.gameMode = gameMode;
        updatedGameState.gameStatus = GameStatus.ACTIVE;

        setGameState(updatedGameState);
        setPlayerSymbol(PlayerSymbol.X);
      }
      setLoggedIn(true);
    }
  };

  const handleCellClick = (index: number) => {
    if (
      !loggedIn ||
      gameState.winner ||
      gameState.gameStatus !== GameStatus.ACTIVE
    )
      return;

    const isMyTurn =
      playerSymbol === gameState.currentPlayer ||
      (gameMode === GameModes.VS_COMPUTER &&
        gameState.currentPlayer === PlayerSymbol.X);

    if (isMyTurn) {
      if (socket && socket.connected) {
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

  const resetGame = () => {
    if (socket && socket.connected) {
      socket.emit("resetGame");
    } else {
      // Local reset - Create a fresh new state to ensure proper reset
      const freshState: GameState = {
        ...initialGameState,
        players: {
          [PlayerSymbol.X]: {
            ...initialGameState.players[PlayerSymbol.X],
            username: username,
            type: PlayerTypes.HUMAN,
            isActive: true,
          },
          [PlayerSymbol.O]: {
            ...initialGameState.players[PlayerSymbol.O],
            username:
              gameMode === GameModes.VS_COMPUTER
                ? "Computer"
                : "Waiting for player...",
            type:
              gameMode === GameModes.VS_COMPUTER
                ? PlayerTypes.COMPUTER
                : PlayerTypes.HUMAN,
            isActive: false,
          },
        },
        gameMode,
        gameStatus:
          gameMode === GameModes.VS_COMPUTER
            ? GameStatus.ACTIVE
            : GameStatus.WAITING,
      };

      setGameState(freshState);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <h1 className="text-4xl font-bold text-indigo-800 mb-8">Tic Tac Toe</h1>
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
          handleLogin={handleLogin}
        />
      ) : (
        <GameBoard
          gameState={gameState}
          message={message}
          handleCellClick={handleCellClick}
          resetGame={resetGame}
          exitGame={() => {
            setLoggedIn(false);
            setGameState(initialGameState);
            setPlayerSymbol(null);
          }}
        />
      )}
    </div>
  );
}
