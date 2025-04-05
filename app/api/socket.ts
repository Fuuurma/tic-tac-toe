import { Server } from "socket.io";
import {
  ClientToServerEvents,
  GameState,
  initialGameState,
  ServerToClientEvents,
} from "../types/types";
import { makeMove } from "../game/logic/makeMove";
import { computerMove } from "../game/ai/logic";
import {
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../game/constants/constants";
import { isOnlineGame } from "../utils/gameModeChecks";

export default function handler(req: any, res: any) {
  if (!res.socket.server.io) {
    console.log("Setting up socket server...");
    const io = new Server<ClientToServerEvents, ServerToClientEvents>(
      res.socket.server
    );
    res.socket.server.io = io;

    let gameState: GameState = { ...initialGameState };

    if (!isOnlineGame(gameState)) return;

    const connectedUsers = new Map<string, string>(); // socketId -> username

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
          playerType = PlayerTypes.HUMAN;
        } else if (!gameState.players[PlayerSymbol.O]?.username) {
          gameState.players[PlayerSymbol.O] = {
            username,
            color: PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
            symbol: PlayerSymbol.O,
            type: PlayerTypes.HUMAN,
            isActive: true,
          };
          playerType = PlayerTypes.HUMAN;
        }

        // Notify player joining
        if (playerType) {
          io.emit("playerJoined", {
            username,
            type: playerType,
          });
        }

        // Broadcast to all connected clients
        io.emit("updateGame", gameState);
      });

      // Handle moves
      socket.on("move", (index) => {
        const username = connectedUsers.get(socket.id);
        if (!username) return;

        if (gameState.gameMode === GameModes.VS_COMPUTER) {
          // In computer mode, only allow player X (human) to make direct moves
          if (
            gameState.players[PlayerSymbol.X].username !== username ||
            gameState.currentPlayer !== PlayerSymbol.X
          ) {
            socket.emit("error", "It's not your turn");
            return;
          }

          // Make player's move
          gameState = makeMove(gameState, index);
          io.emit("updateGame", gameState);

          // If it's computer's turn and no winner yet, make computer move
          if (gameState.currentPlayer === PlayerSymbol.O && !gameState.winner) {
            setTimeout(() => {
              const aiEngine = new AI_MoveEngine(gameState);
              gameState = aiEngine.getOptimalMove();
              io.emit("updateGame", gameState);
            }, 700);
          }
        } else {
          // Human vs human mode
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
        }
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
          if (gameState.players[PlayerSymbol.X].username === username) {
            gameState.players[PlayerSymbol.X].isActive = false;
            gameState.players[PlayerSymbol.X].username = "";
          } else if (gameState.players[PlayerSymbol.O].username === username) {
            gameState.players[PlayerSymbol.O].isActive = false;
            gameState.players[PlayerSymbol.O].username = "";
          }
          connectedUsers.delete(socket.id);

          // If both players are gone, reset the game
          if (
            !gameState.players[PlayerSymbol.X].isActive &&
            !gameState.players[PlayerSymbol.O].isActive
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
