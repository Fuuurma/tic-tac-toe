import { Server } from "socket.io";
import {
  ClientToServerEvents,
  GameState,
  initialGameState,
  ServerToClientEvents,
} from "../types/types";
import { makeMove } from "../game/logic/makeMove";

export default function handler(req: any, res: any) {
  if (!res.socket.server.io) {
    console.log("Setting up socket server...");
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(
      res.socket.server
    );
    res.socket.server.io = io;

    let gameState: GameState = { ...initialGameState };
    const connectedUsers = new Map<string, string>(); // socketId -> username

    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      // Handle user login
      socket.on("login", (username) => {
        connectedUsers.set(socket.id, username);

        // Assign player type (X, O, or spectator)
        let playerType = null;
        if (!gameState.players.X) {
          gameState.players.X = username;
          playerType = "X";
        } else if (!gameState.players.O) {
          gameState.players.O = username;
          playerType = "O";
        }

        // Notify player joining
        if (playerType) {
          io.emit("playerJoined", { username, type: playerType });

          // Send to the specific socket their player type
          socket.emit("updateGame", {
            ...gameState,
            currentPlayer: gameState.currentPlayer,
          });
        } else {
          // Spectator
          socket.emit("updateGame", gameState);
        }
      });

      // Handle moves
      socket.on("move", (index) => {
        const username = connectedUsers.get(socket.id);
        if (!username) return;

        // Check if it's this player's turn
        const playerType =
          gameState.players.X === username
            ? "X"
            : gameState.players.O === username
            ? "O"
            : null;

        if (playerType !== gameState.currentPlayer) {
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
          gameState.players.X === username ||
          gameState.players.O === username
        ) {
          gameState = {
            ...initialGameState,
            players: gameState.players, // Keep players
          };
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
          if (gameState.players.X === username) {
            gameState.players.X = null;
          } else if (gameState.players.O === username) {
            gameState.players.O = null;
          }
          connectedUsers.delete(socket.id);

          // If both players are gone, reset the game
          if (!gameState.players.X && !gameState.players.O) {
            gameState = { ...initialGameState };
          }

          io.emit("updateGame", gameState);
        }
      });
    });
  }

  res.end();
}
