import {
  PlayerSymbol,
  PLAYER_CONFIG,
  PlayerTypes,
} from "@/app/game/constants/constants";
import { makeMove } from "@/app/game/logic/makeMove";
import { initialGameState } from "@/app/types/types";
import { isOnlineGame } from "@/app/utils/gameModeChecks";
import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import { NextApiRequest, NextApiResponse } from "next";

interface SocketServer extends HTTPServer {
  io?: Server;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  if (!res.socket.server.io) {
    console.log("Setting up socket server...");

    const io = new Server(res.socket.server, {
      path: "/api/socket",
      addTrailingSlash: false,
    });

    res.socket.server.io = io;

    let gameState = { ...initialGameState };
    const connectedUsers = new Map(); // socketId -> username

    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      // Handle user login
      socket.on("login", (username, gameMode) => {
        connectedUsers.set(socket.id, username);

        // Set the game mode
        gameState.gameMode = gameMode;

        if (!isOnlineGame(gameState)) return;

        // Assign player type and opponent
        let playerType = null;

        if (!gameState.players[PlayerSymbol.X]?.username) {
          gameState.players[PlayerSymbol.X] = {
            username,
            color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
            symbol: PlayerSymbol.X,
            type: PlayerTypes.HUMAN,
            isActive: true,
          };
          playerType = PlayerSymbol.X;

          // Notify user they're X
          socket.emit("playerAssigned", PlayerSymbol.X);
        } else if (!gameState.players[PlayerSymbol.O]?.username) {
          gameState.players[PlayerSymbol.O] = {
            username,
            color: PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
            symbol: PlayerSymbol.O,
            type: PlayerTypes.HUMAN,
            isActive: true,
          };
          playerType = PlayerSymbol.O;

          // Notify user they're O
          socket.emit("playerAssigned", PlayerSymbol.O);
        } else {
          // Game is full
          socket.emit("error", "Game is full, please try again later");
          return;
        }

        // Notify all of player joining
        io.emit("playerJoined", {
          username,
          type: playerType,
        });

        // Broadcast the updated game state
        io.emit("updateGame", gameState);
      });

      // Handle moves
      socket.on("move", (index) => {
        const username = connectedUsers.get(socket.id);
        if (!username) return;

        if (!isOnlineGame(gameState)) return;

        // Check if it's this player's turn
        const playerSymbol =
          gameState.players[PlayerSymbol.X].username === username
            ? PlayerSymbol.X
            : gameState.players[PlayerSymbol.O].username === username
            ? PlayerSymbol.O
            : null;

        if (playerSymbol !== gameState.currentPlayer) {
          socket.emit("error", "It's not your turn");
          return;
        }

        // Make the move
        gameState = makeMove(gameState, index);

        // Broadcast updated state
        io.emit("updateGame", gameState);
      });

      // Handle game reset
      socket.on("resetGame", () => {
        const username = connectedUsers.get(socket.id);
        if (!username) return;

        // Only players can reset
        if (
          gameState.players[PlayerSymbol.X].username === username ||
          gameState.players[PlayerSymbol.O].username === username
        ) {
          const freshState = {
            ...initialGameState,
            players: { ...gameState.players }, // Keep the same players
            gameMode: gameState.gameMode, // Keep the same game mode
          };

          gameState = freshState;

          io.emit("gameReset");
          io.emit("updateGame", gameState);
        }
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        const username = connectedUsers.get(socket.id);
        console.log("User disconnected:", socket.id, username);

        if (username) {
          // Remove player if they disconnect
          if (gameState.players[PlayerSymbol.X]?.username === username) {
            gameState.players[PlayerSymbol.X].isActive = false;
            gameState.players[PlayerSymbol.X].username = "";
          } else if (gameState.players[PlayerSymbol.O]?.username === username) {
            gameState.players[PlayerSymbol.O].isActive = false;
            gameState.players[PlayerSymbol.O].username = "";
          }
          connectedUsers.delete(socket.id);

          // If both players are gone, reset the game
          if (
            !gameState.players[PlayerSymbol.X]?.isActive &&
            !gameState.players[PlayerSymbol.O]?.isActive
          ) {
            gameState = { ...initialGameState };
          }

          io.emit("updateGame", gameState);
        }
      });
    });
  }

  res.end();
}

// For App Router, add this:
export const config = {
  api: {
    bodyParser: false,
  },
};
