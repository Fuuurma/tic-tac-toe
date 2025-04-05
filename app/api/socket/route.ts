import {
  PlayerSymbol,
  PLAYER_CONFIG,
  PlayerTypes,
} from "@/app/game/constants/constants";
import { createServer } from "http";
import { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket as NetSocket } from "net";
import { makeMove } from "@/app/game/logic/makeMove";
import { initialGameState } from "@/app/types/types";
import { isOnlineGame } from "@/app/utils/gameModeChecks";
import { NextResponse } from "next/server";
import { Server } from "socket.io";

// Create a global variable to store the Socket.IO server instance
let io: Server;

// Create a Map to store connected users
const connectedUsers = new Map();

// Store the game state
let gameState = { ...initialGameState };

export async function GET() {
  if (!io) {
    // Create a new HTTP server
    const httpServer = createServer();

    // Create a new Socket.IO server
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    // Set up Socket.IO event handlers
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      // Handle user login
      socket.on("login", (username, gameMode) => {
        console.log(`User ${username} logged in with game mode ${gameMode}`);
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
            players: { ...gameState.players },
            gameMode: gameState.gameMode,
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

    // Start the HTTP server
    httpServer.listen(3009);
    console.log("Socket.IO server started on port 3009");
  }

  return NextResponse.json({ ok: true });
}

//     let gameState = { ...initialGameState };
//     const connectedUsers = new Map(); // socketId -> username

//     io.on("connection", (socket) => {
//       console.log("A user connected:", socket.id);

//       // Handle user login
//       socket.on("login", (username, gameMode) => {
//         connectedUsers.set(socket.id, username);

//         // Set the game mode
//         gameState.gameMode = gameMode;

//         if (!isOnlineGame(gameState)) return;

//         // Assign player type and opponent
//         let playerType = null;

//         if (!gameState.players[PlayerSymbol.X]?.username) {
//           gameState.players[PlayerSymbol.X] = {
//             username,
//             color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
//             symbol: PlayerSymbol.X,
//             type: PlayerTypes.HUMAN,
//             isActive: true,
//           };
//           playerType = PlayerSymbol.X;

//           // Notify user they're X
//           socket.emit("playerAssigned", PlayerSymbol.X);
//         } else if (!gameState.players[PlayerSymbol.O]?.username) {
//           gameState.players[PlayerSymbol.O] = {
//             username,
//             color: PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
//             symbol: PlayerSymbol.O,
//             type: PlayerTypes.HUMAN,
//             isActive: true,
//           };
//           playerType = PlayerSymbol.O;

//           // Notify user they're O
//           socket.emit("playerAssigned", PlayerSymbol.O);
//         } else {
//           // Game is full
//           socket.emit("error", "Game is full, please try again later");
//           return;
//         }

//         // Notify all of player joining
//         io.emit("playerJoined", {
//           username,
//           type: playerType,
//         });

//         // Broadcast the updated game state
//         io.emit("updateGame", gameState);
//       });

//       // Handle moves
//       socket.on("move", (index) => {
//         const username = connectedUsers.get(socket.id);
//         if (!username) return;

//         if (!isOnlineGame(gameState)) return;

//         // Check if it's this player's turn
//         const playerSymbol =
//           gameState.players[PlayerSymbol.X].username === username
//             ? PlayerSymbol.X
//             : gameState.players[PlayerSymbol.O].username === username
//             ? PlayerSymbol.O
//             : null;

//         if (playerSymbol !== gameState.currentPlayer) {
//           socket.emit("error", "It's not your turn");
//           return;
//         }

//         // Make the move
//         gameState = makeMove(gameState, index);

//         // Broadcast updated state
//         io.emit("updateGame", gameState);
//       });

//       // Handle game reset
//       socket.on("resetGame", () => {
//         const username = connectedUsers.get(socket.id);
//         if (!username) return;

//         // Only players can reset
//         if (
//           gameState.players[PlayerSymbol.X].username === username ||
//           gameState.players[PlayerSymbol.O].username === username
//         ) {
//           const freshState = {
//             ...initialGameState,
//             players: { ...gameState.players }, // Keep the same players
//             gameMode: gameState.gameMode, // Keep the same game mode
//           };

//           gameState = freshState;

//           io.emit("gameReset");
//           io.emit("updateGame", gameState);
//         }
//       });

//       // Handle disconnection
//       socket.on("disconnect", () => {
//         const username = connectedUsers.get(socket.id);
//         console.log("User disconnected:", socket.id, username);

//         if (username) {
//           // Remove player if they disconnect
//           if (gameState.players[PlayerSymbol.X]?.username === username) {
//             gameState.players[PlayerSymbol.X].isActive = false;
//             gameState.players[PlayerSymbol.X].username = "";
//           } else if (gameState.players[PlayerSymbol.O]?.username === username) {
//             gameState.players[PlayerSymbol.O].isActive = false;
//             gameState.players[PlayerSymbol.O].username = "";
//           }
//           connectedUsers.delete(socket.id);

//           // If both players are gone, reset the game
//           if (
//             !gameState.players[PlayerSymbol.X]?.isActive &&
//             !gameState.players[PlayerSymbol.O]?.isActive
//           ) {
//             gameState = { ...initialGameState };
//           }

//           io.emit("updateGame", gameState);
//         }
//       });
//     });
//   }

//   res.status(200).json({ message: "Socket server initialized" });

//   res.end();
// }

// // For App Router, add this:
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };
