import {
  ClientToServerEvents,
  GameRoom,
  ServerToClientEvents,
  SocketData,
} from "@/app/types/types";
import { Server, Socket } from "socket.io";

import {
  Color,
  Events,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../constants/constants";
import { makeMove } from "../logic/makeMove";
import { createOnlineGameState } from "./createOnlineGameState";

type ValidationResult = { isValid: true } | { isValid: false; error: string };

export class GameServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents, SocketData>;
  private rooms: Map<string, GameRoom> = new Map();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      // If running on a separate port, path might not be needed depending on client connection
      // path: "/api/socket/io", // Keep if attaching to Next.js server on default port
    });

    this.setupEvents();
    console.log("GameServer initialized");
  }

  // --- SETUP  ---

  private setupEvents(): void {
    this.io.on(Events.CONNECTION, (socket) => {
      console.log(`User connected: ${socket.id}`);
      this.registerEventHandlers(socket);
    });
  }

  private registerEventHandlers(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    socket.on(Events.LOGIN, (username, color) =>
      this.handleLogin(socket, username, color)
    );
    socket.on(Events.DISCONNECT, () => this.handleDisconnect(socket));
    socket.on(Events.MOVE, (index) => this.handleMove(socket, index));
    // socket.on(Events.RESET, () => this.handleResetRequest(socket)); // Deprecate direct reset?
    socket.on(Events.REQUEST_REMATCH, () => this.handleRequestRematch(socket));
    socket.on(Events.ACCEPT_REMATCH, () => this.handleAcceptRematch(socket));
    socket.on(Events.DECLINE_REMATCH, () => this.handleDeclineRematch(socket));
    socket.on(Events.LEAVE_ROOM, () => this.handleLeaveRoom(socket));

    socket.on("error", (err) => {
      console.error(`Socket ${socket.id} error: ${err.message}`);
    });
  }

  // --- Helper Functions ---

  // --- Room Management ---

  private findAvailableRoomOrCreate(): GameRoom {
    for (const room of this.rooms.values()) {
      if (room.playerSocketIds.size < 2) {
        console.log(`Found available room: ${room.id}`);
        return room;
      }
    }
    return this.createNewRoom();
  }

  private createNewRoom(): GameRoom {
    const newRoomId = `room-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const newRoom: GameRoom = {
      id: newRoomId,
      playerSocketIds: new Set(),
      state: createOnlineGameState(),
      rematchState: "none", // Initialize rematch state
      rematchRequesterSymbol: null,
    };
    this.rooms.set(newRoomId, newRoom);
    console.log(`Created new room: ${newRoomId}`);
    return newRoom;
  }

  private getRoomById(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  private getPlayerRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): GameRoom | undefined {
    const roomId = socket.data.roomId;
    return roomId ? this.getRoomById(roomId) : undefined;
  }

  // Gets the socket instance of the opponent in the room
  private getOpponentSocket(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    room: GameRoom
  ):
    | Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
    | undefined {
    const opponentSocketId = Array.from(room.playerSocketIds).find(
      (id) => id !== socket.id
    );
    return opponentSocketId
      ? this.io.sockets.sockets.get(opponentSocketId)
      : undefined;
  }

  private assignPlayerColor(
    room: GameRoom,
    joiningSymbol: PlayerSymbol,
    preferredColor: Color
  ): Color {
    const opponentSymbol =
      joiningSymbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
    const opponent = room.state.players[opponentSymbol];

    // If opponent exists and has the same preferred color
    if (opponent?.isActive && opponent.color === preferredColor) {
      // Find the first available color that is different
      for (const availableColor of Object.values(Color)) {
        if (availableColor !== opponent.color) {
          console.log(
            `Color conflict for ${joiningSymbol}. Assigning ${availableColor} instead of ${preferredColor}.`
          );
          return availableColor;
        }
      }
      // Fallback if somehow all colors are the same (shouldn't happen with >1 color)
      return PLAYER_CONFIG[joiningSymbol].defaultColor;
    }
    // No conflict or no active opponent yet, use preferred or default
    return preferredColor || PLAYER_CONFIG[joiningSymbol].defaultColor;
  }

  // --- Event Handlers ---

  private handleLogin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    username: string,
    preferredColor: Color
  ): void {
    if (!username || username.trim().length === 0) {
      socket.emit("error", "Invalid username.");
      return;
    }

    // Prevent double login if already in a room
    if (socket.data.roomId) {
      socket.emit("error", "Already in a room.");
      return;
    }

    const room = this.findAvailableRoomOrCreate();
    const roomId = room.id;

    // Assign player symbol and data
    const symbol =
      room.playerSocketIds.size === 0 ? PlayerSymbol.X : PlayerSymbol.O;
    const color = preferredColor || PLAYER_CONFIG[symbol].defaultColor; // Use preferred or default color

    // Store essential info in socket.data for easier access later
    socket.data.username = username;
    socket.data.roomId = roomId;
    socket.data.symbol = symbol;

    // Add player to the room (Socket.IO room and our internal set)
    socket.join(roomId);
    room.playerSocketIds.add(socket.id);

    // Update the GameState with player details
    room.state.players[symbol] = {
      username: username,
      symbol: symbol,
      type: PlayerTypes.HUMAN, // Assuming online players are human
      color: color,
      isActive: true,
    };

    console.log(
      `Player ${username}(${socket.id}) joined room ${roomId} as ${symbol}`
    );

    // Notify the player they've been assigned
    socket.emit("playerAssigned", { symbol, roomId });

    // Notify others in the room (if any) that a player joined
    // Note: `socket.to(roomId)` sends to everyone in the room *except* the sender
    socket.to(roomId).emit("playerJoined", { username, symbol });

    // If room is now full, start the game
    if (room.playerSocketIds.size === 2) {
      // Ensure player 'O' username and color are set correctly (might already be if they logged in)
      const opponentSymbol =
        symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
      const opponentSocketId = Array.from(room.playerSocketIds).find(
        (id) => id !== socket.id
      );
      if (opponentSocketId && !room.state.players[opponentSymbol]?.username) {
        // Fetch opponent data if missing (this depends on how you handle the second player's login)
        // This might indicate a logic issue if player data isn't fully populated before game start
        console.warn(
          `Opponent data potentially missing for ${opponentSymbol} in room ${roomId}`
        );
      }

      room.state.gameStatus = GameStatus.ACTIVE; // Set status to active
      room.state.currentPlayer = PlayerSymbol.X; // X always starts? Or randomize?
      console.log(`Game starting in room ${roomId}`);
      // Emit 'gameStart' to EVERYONE in the room (including sender) with the initial state
      this.io.to(roomId).emit("gameStart", room.state);
    } else {
      // If waiting for opponent, send the current state (which includes the first player's info)
      room.state.gameStatus = GameStatus.WAITING; // Explicitly set waiting status
      socket.emit("gameUpdate", room.state); // Send partial state to the first player
      console.log(`Room ${roomId} waiting for opponent.`);
    }
  }

  private handleMove(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    index: number
  ): void {
    const room = this.getPlayerRoom(socket);
    const playerSymbol = socket.data.symbol;

    // Validations
    if (!room) {
      socket.emit("error", "Not in a valid room.");
      return;
    }
    if (!playerSymbol) {
      socket.emit("error", "Player symbol not assigned.");
      return;
    }
    if (room.state.gameStatus !== GameStatus.ACTIVE) {
      socket.emit("error", "Game is not active.");
      return;
    }
    if (room.state.winner) {
      socket.emit("error", "Game is already over.");
      return;
    }
    if (playerSymbol !== room.state.currentPlayer) {
      socket.emit("error", "Not your turn.");
      return;
    }
    if (
      index < 0 ||
      index >= room.state.board.length ||
      room.state.board[index] !== null
    ) {
      socket.emit("error", "Invalid move.");
      return;
    }

    console.log(
      `Player ${playerSymbol} in room ${room.id} attempts move at index ${index}`
    );

    // Apply the move using the game logic function
    try {
      room.state = makeMove(room.state, index); // Update the state IN PLACE
      console.log(
        `Move successful in room ${room.id}. New current player: ${room.state.currentPlayer}`
      );

      // Broadcast the updated state to everyone in the room
      this.io.to(room.id).emit("gameUpdate", room.state);

      // Check if game ended after the move
      if (room.state.winner) {
        room.state.gameStatus = GameStatus.COMPLETED;
        console.log(
          `Game finished in room ${room.id}. Winner: ${room.state.winner}`
        );
        // No extra emit needed here, gameUpdate already sent the winning state
      } else if (
        room.state.gameStatus === GameStatus.ACTIVE &&
        room.state.players[room.state.currentPlayer].type ===
          PlayerTypes.COMPUTER
      ) {
        // If it's now an AI's turn (e.g., placeholder AI in online mode?)
        // This logic might not belong here if online is strictly Human vs Human
        console.log("AI turn logic triggered (if applicable)");
      }
    } catch (error: any) {
      console.error(`Error during move in room ${room.id}: ${error.message}`);
      socket.emit("error", `Move failed: ${error.message || "Unknown error"}`);
    }
  }

  private handleReset(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const room = this.getPlayerRoom(socket);

    if (!room) {
      socket.emit("error", "Not in a valid room.");
      return;
    }

    // Optional: Allow reset only if game is finished or > 1 player?
    if (room.state.gameStatus === GameStatus.ACTIVE) {
      socket.emit("error", "Cannot reset active game.");
      return;
    }

    console.log(
      `Reset request from ${socket.data.username} in room ${room.id}`
    );

    // Store current player data (ensure deep copy if necessary, but references should be fine if not mutating player objects directly)
    const currentPlayersData = { ...room.state.players };

    // Reset game state but keep player info and room structure
    room.state = {
      ...createOnlineGameState(), // Get a fresh board, winner=null, etc.
      players: currentPlayersData, // Restore player details
      gameStatus:
        room.playerSocketIds.size === 2
          ? GameStatus.ACTIVE
          : GameStatus.WAITING, // Reset status based on player count
      currentPlayer: PlayerSymbol.X, // Reset starting player
    };

    // Ensure players are marked active (might have been inactive on disconnect/reconnect)
    Array.from(room.playerSocketIds).forEach((socketId) => {
      const playerSocket = this.io.sockets.sockets.get(socketId);
      const symbol = playerSocket?.data.symbol;

      if (symbol && Object.values(PlayerSymbol).includes(symbol)) {
        room.state.players[symbol as PlayerSymbol].isActive = true;
      }
    });

    console.log(
      `Game reset in room ${room.id}. Status: ${room.state.gameStatus}`
    );
    // Broadcast the reset state to everyone in the room
    this.io.to(room.id).emit("gameReset", room.state);
  }

  private handleDisconnect(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const roomId = socket.data.roomId;
    const playerSymbol = socket.data.symbol;
    const username = socket.data.username || socket.id; // Use username if available

    console.log(
      `User disconnected: ${username} (${socket.id}), was in room ${roomId}`
    );

    if (roomId) {
      const room = this.getRoomById(roomId);
      if (room) {
        // Remove player from the room's socket set
        room.playerSocketIds.delete(socket.id);

        console.log(
          `Removed ${socket.id} from room ${roomId}. Size: ${room.playerSocketIds.size}`
        );

        // Mark player as inactive in the game state if they had a symbol
        const symbol = socket.data.symbol;
        if (symbol && Object.values(PlayerSymbol).includes(symbol)) {
          room.state.players[symbol as PlayerSymbol].isActive = false;
        }

        // Update room status
        room.state.gameStatus = GameStatus.WAITING; // Or FINISHED if you prefer

        // If the room is now empty, delete it
        if (room.playerSocketIds.size === 0) {
          this.rooms.delete(roomId);
          console.log(`Room ${roomId} is empty, deleting.`);
        } else {
          // Notify the remaining player(s)
          console.log(
            `Notifying remaining players in room ${roomId} about disconnect.`
          );
          // Emit state update AND specific playerLeft event
          this.io.to(roomId).emit("gameUpdate", room.state); // Send updated state showing inactive player
          this.io
            .to(roomId)
            .emit("playerLeft", { symbol: playerSymbol || null });
        }
      } else {
        console.log(
          `Room ${roomId} not found during disconnect for ${socket.id}.`
        );
      }
    }
    // Clean up socket data regardless
    socket.data = {};
  }
}
