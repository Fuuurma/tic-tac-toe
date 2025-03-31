"use client";

import { useEffect, useState } from "react";
import {
  ClientToServerEvents,
  GameState,
  PlayerType,
  ServerToClientEvents,
} from "./types/types";
import { io, Socket } from "socket.io-client";
import { initialGameState } from "./game/logic/logic";
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

  useEffect(() => {
    const newSocket = io() as Socket<
      ServerToClientEvents,
      ClientToServerEvents
    >;
    setSocket(newSocket);

    // Listen for game updates
    newSocket.on("updateGame", (newGameState) => {
      setGameState(newGameState);
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

  const handleLogin = () => {
    if (username.trim() && socket) {
      socket.emit("login", username);
      setLoggedIn(true);
    }
  };

  const handleCellClick = (index: number) => {
    if (!loggedIn || !socket || gameState.winner) return;

    // Only allow moves if it's your turn
    if (playerType === gameState.currentPlayer) {
      socket.emit("move", index);
    } else {
      setMessage("It's not your turn");
      setTimeout(() => setMessage(""), 2000);
    }
  };

  const resetGame = () => {
    if (socket) {
      socket.emit("resetGame");
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
