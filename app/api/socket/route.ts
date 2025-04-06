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
import { GameServer } from "@/app/game/online/gameServer";

// --- Singleton Pattern for Server Initialization ---
// Use a closure or a simple object to ensure server starts only once.
const initSocketServer = (() => {
  let gameServerInstance: GameServer | null = null;
  let httpServer: ReturnType<typeof createServer> | null = null;

  return () => {
    if (!gameServerInstance) {
      console.log("Initializing Socket.IO server...");
      // Create a basic HTTP server instance (not linked to Next.js requests)
      httpServer = createServer();

      // Initialize the GameServer with this HTTP server
      gameServerInstance = new GameServer(httpServer);

      const port = parseInt(process.env.SOCKET_PORT || "3009", 10);
      httpServer.listen(port, () => {
        console.log(`✅ Socket.IO server listening on port ${port}`);
      });

      // Optional: Handle server errors
      httpServer.on("error", (error) => {
        console.error("HTTP Server Error:", error);
        // Potentially reset instance state if needed
        gameServerInstance = null;
        httpServer = null;
      });
    } else {
      console.log("Socket.IO server already running."); // Optional debug log
    }
    return { gameServerInstance, httpServer };
  };
})();
// --- End Singleton ---

// This API route now primarily serves to ENSURE the server is running
// and maybe return status, but doesn't handle socket connections directly.
export async function GET() {
  try {
    const { httpServer } = initSocketServer(); // Ensure the server starts if not already running

    if (!httpServer?.listening) {
      console.warn("Socket server HTTP instance not listening yet or failed.");
      // Throw an error or return a specific status
      return NextResponse.json({ status: "initializing" }, { status: 503 }); // Service Unavailable during init
    }

    // console.log("API route check: Socket server should be running.");
    return NextResponse.json({ status: "running" });
  } catch (error: any) {
    console.error("Error in /api/socket GET handler:", error);
    return NextResponse.json(
      { error: "Failed to initialize socket server", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * IMPORTANT CONSIDERATIONS FOR DEPLOYMENT:
 * 1. Stateful Server: Socket.IO requires a long-running, stateful server process.
 * Serverless environments (like default Vercel deployments) are generally NOT suitable
 * because they spin down instances. You'll likely need a traditional Node.js server
 * hosting environment (like Vercel Hobby with persistent instances, Render, Railway, AWS EC2, etc.).
 * 2. Separate Port: You need to ensure the port (e.g., 3009) is accessible and properly mapped
 * in your deployment environment and that the client can reach it.
 * 3. Environment Variables: Use process.env variables for the port (SOCKET_PORT) and potentially
 * the client-side connection URL.
 */

// OLD
// // Create a global variable to store the HTTP server and GameServer instance
// let server: any;
// let gameServer: GameServer;

// export async function GET() {
//   if (!server) {
//     // Create a new HTTP server
//     server = createServer();

//     // Initialize the GameServer with our HTTP server
//     gameServer = new GameServer(server);

//     // Start the HTTP server
//     server.listen(3009);
//     console.log("Socket.IO server started on port 3009");
//   }

//   return NextResponse.json({ ok: true });
// }

// // OLD - Was working - Now integrate GameServer class
// // Create a global variable to store the Socket.IO server instance
// let io: Server;

// // Create a Map to store connected users
// const connectedUsers = new Map();

// // Store the game state
// let gameState = { ...initialGameState };

// export async function GET() {
//   if (!io) {
//     // Create a new HTTP server
//     const httpServer = createServer();

//     // Create a new Socket.IO server
//     io = new Server(httpServer, {
//       cors: {
//         origin: "*",
//         methods: ["GET", "POST"],
//       },
//     });

//     // Set up Socket.IO event handlers
//     io.on("connection", (socket) => {
//       console.log("A user connected:", socket.id);

//       // Handle user login
//       socket.on("login", (username, gameMode) => {
//         console.log(`User ${username} logged in with game mode ${gameMode}`);
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
//             players: { ...gameState.players },
//             gameMode: gameState.gameMode,
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
