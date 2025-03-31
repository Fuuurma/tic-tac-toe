"use client";

import { useEffect, useState } from "react";
import {
  ClientToServerEvents,
  GameMode,
  GameState,
  PlayerType,
  ServerToClientEvents,
} from "./types/types";
import { io, Socket } from "socket.io-client";
import { computerMove, initialGameState, makeMove } from "./game/logic/logic";
import { Button } from "@/components/ui/button";

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
      // Local reset
      setGameState({
        ...initialGameState,
        players: {
          X: username,
          O: gameMode === "computer" ? "Computer" : null,
        },
        gameMode,
      });
    }
  };

  return (
    <div className="flex flex-col items-center mt-10 p-4">
      <h1 className="text-3xl font-bold mb-6">Tic Tac Toe</h1>

      {!loggedIn ? (
        <div className="mb-6 p-4 border rounded shadow-sm">
          <h2 className="text-xl mb-2">Login</h2>
          <div className="flex">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="border p-2 mr-2 rounded"
            />
            <Button onClick={handleLogin}>Join Game</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 text-lg">
            <span>
              Playing as: <b>{playerType || "Spectator"}</b>
            </span>
          </div>

          {message && (
            <div className="mb-4 p-2 bg-gray-100 rounded">{message}</div>
          )}

          <div className="mb-4">
            <div className="flex justify-between w-full">
              <div className="mx-4">
                Player X: {gameState.players.X || "Waiting..."}
              </div>
              <div className="mx-4">
                Player O: {gameState.players.O || "Waiting..."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {gameState.board.map((cell, i) => (
              <button
                key={i}
                className={`w-20 h-20 border text-3xl flex items-center justify-center
                  ${gameState.moves.X.includes(i) ? "bg-blue-100" : ""}
                  ${gameState.moves.O.includes(i) ? "bg-red-100" : ""}
                  ${
                    gameState.currentPlayer === playerType && !cell
                      ? "hover:bg-gray-100"
                      : ""
                  }`}
                onClick={() => handleCellClick(i)}
              >
                {cell}
              </button>
            ))}
          </div>

          {gameState.winner && (
            <div className="mb-4 text-xl">
              {gameState.winner === "draw"
                ? "It's a draw!"
                : `Player ${gameState.winner} wins!`}
            </div>
          )}

          <Button onClick={resetGame}>Reset Game</Button>
        </>
      )}
    </div>
  );
}
