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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-cyan-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-indigo-800 mb-8">Tic Tac Toe</h1>

      {!loggedIn ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome to Tic Tac Toe</CardTitle>
            <CardDescription>
              Enter your username and select game mode to start playing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full p-2 border rounded-md"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Game Mode</div>
              <RadioGroup
                defaultValue="human"
                onValueChange={(value) => setGameMode(value as GameMode)}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="human" id="human" />
                  <Label htmlFor="human">Play against another player</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="computer" id="computer" />
                  <Label htmlFor="computer">Play against computer</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleLogin} className="w-full">
              Start Game
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>
              {gameMode === "computer"
                ? "Playing vs Computer"
                : "Multiplayer Game"}
            </CardTitle>
            <CardDescription>
              Playing as:{" "}
              <span className="font-bold">{playerType || "Spectator"}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {message && (
              <div className="p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                {message}
              </div>
            )}

            <div className="flex justify-between text-sm">
              <div className="px-3 py-1 bg-blue-100 rounded-full">
                X: {gameState.players.X || "Waiting..."}
              </div>
              <div className="px-3 py-1 bg-red-100 rounded-full">
                O: {gameState.players.O || "Waiting..."}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6 aspect-square">
              {gameState.board.map((cell, i) => (
                <button
                  key={i}
                  className={`h-full w-full rounded-md border-2 flex items-center justify-center text-3xl font-bold transition-all duration-200 ${
                    cell === "X"
                      ? "bg-blue-100 border-blue-300 text-blue-600"
                      : cell === "O"
                      ? "bg-red-100 border-red-300 text-red-600"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  } ${gameState.moves.X.includes(i) ? "shadow-md" : ""} ${
                    gameState.moves.O.includes(i) ? "shadow-md" : ""
                  } ${
                    gameState.currentPlayer === playerType &&
                    !cell &&
                    !gameState.winner
                      ? "cursor-pointer hover:border-gray-400"
                      : "cursor-default"
                  }`}
                  onClick={() => handleCellClick(i)}
                  disabled={!!cell || !!gameState.winner}
                >
                  {cell}
                </button>
              ))}
            </div>

            {gameState.winner && (
              <div className="text-center p-3 bg-green-100 text-green-800 rounded-md font-medium">
                {gameState.winner === "draw"
                  ? "It's a draw!"
                  : `Player ${gameState.winner} wins!`}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button onClick={resetGame} variant="outline">
              Reset Game
            </Button>
            <Button
              onClick={() => {
                setLoggedIn(false);
                setGameState(initialGameState);
                setPlayerType(null);
              }}
              variant="ghost"
            >
              Exit Game
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
