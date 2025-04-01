"use client";

import { useEffect, useState } from "react";
import {
  ClientToServerEvents,
  GameMode,
  GameState,
  initialGameState,
  PlayerType,
  ServerToClientEvents,
} from "./types/types";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { computerMove } from "./game/ai/logic";
import { makeMove } from "./game/logic/makeMove";
import LoginForm from "@/components/auth/loginForm";
import GameBoard from "@/components/game/board";

export default function Home() {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [username, setUsername] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [playerType, setPlayerType] = useState<PlayerType | null>(null);
  const [message, setMessage] = useState<string>("");
  const [gameMode, setGameMode] = useState<GameMode>("human");

  useEffect(() => {
    const newSocket = io() as Socket<
      ServerToClientEvents,
      ClientToServerEvents
    >;
    setSocket(newSocket);

    // Listen for game updates
    newSocket.on("updateGame", (newGameState) => {
      setGameState(newGameState);
      setPlayerType((prev) => {
        // If we're playing against computer, always set as X
        if (newGameState.gameMode === "computer") {
          return "X";
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
      gameState.gameMode === "computer" &&
      gameState.currentPlayer === "O" &&
      !gameState.winner
    ) {
      // Add a slight delay to make it feel more natural
      const timer = setTimeout(() => {
        const newState = computerMove(gameState);
        // Only update if playing locally, otherwise server handles it
        if (!socket || !socket.connected) {
          setGameState(newState);
        } else {
          // In case of online play, tell server the computer moved
          socket.emit("move", newState.moves.O[newState.moves.O.length - 1]);
        }
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [gameState, socket]);

  const handleLogin = () => {
    if (username.trim()) {
      if (socket && socket.connected) {
        socket.emit("login", username, gameMode);
      } else {
        // Local play against computer
        setGameState({
          ...initialGameState,
          players: {
            X: username,
            O: gameMode === "computer" ? "Computer" : null,
          },
          gameMode,
        });
        setPlayerType("X");
      }
      setLoggedIn(true);
    }
  };

  const handleCellClick = (index: number) => {
    if (!loggedIn || gameState.winner) return;

    // Check if it's the player's turn
    if (
      gameState.currentPlayer === playerType ||
      (gameMode === "computer" && gameState.currentPlayer === "X")
    ) {
      if (socket && socket.connected) {
        socket.emit("move", index);
      } else {
        // Local play logic
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
      const freshState = {
        ...initialGameState,
        players: {
          X: username,
          O: gameMode === "computer" ? "Computer" : null,
        },
        gameMode,
        board: Array(9).fill(null),
        moves: { X: [], O: [] },
        nextToRemove: { X: null, O: null },
        currentPlayer: "X",
        winner: null,
      } as GameState;
      setGameState(freshState);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-cyan-50">
      <h1 className="text-4xl font-bold text-indigo-800 mb-8">Tic Tac Toe</h1>
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
            setPlayerType(null);
          }}
        />
      )}
    </div>
  );
}
