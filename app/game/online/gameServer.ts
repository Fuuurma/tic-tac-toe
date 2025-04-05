import {
  ClientToServerEvents,
  GameRoom,
  ServerToClientEvents,
  SocketData,
} from "@/app/types/types";
import { Server, Socket } from "socket.io";

import {
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../constants/constants";
import { makeMove } from "../logic/makeMove";
import { createOnlineGameState } from "./createOnlineGameState";

export class GameServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents, SocketData>;
  private rooms: Map<string, GameRoom> = new Map();
  private matchmaker = new Matchmaker();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      // If running on a separate port, path might not be needed depending on client connection
      // path: "/api/socket/io", // Keep if attaching to Next.js server on default port
    });

    this.setupEvents();
    console.log("GameServer initialized");
  }

  private setupEvents(): void {
    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Attach handlers with proper typing
      socket.on("login", (username, color) =>
        this.handleLogin(socket, username, color)
      );
      socket.on("disconnect", () => this.handleDisconnect(socket));
      socket.on("move", (index) => this.handleMove(socket, index));
      socket.on("reset", () => this.handleReset(socket)); // Listen for 'reset'

      // Optional: Error handler for socket middleware or general errors
      socket.on("error", (err) => {
        console.error(`Socket ${socket.id} error: ${err.message}`);
        // Optionally disconnect socket on critical errors
      });
    });
  }

  // --- Room Management ---

  private findAvailableRoomOrCreate(): GameRoom {
    // 1. Find an existing room with less than 2 players
    for (const room of this.rooms.values()) {
      if (room.playerSocketIds.size < 2) {
        console.log(`Found available room: ${room.id}`);
        return room;
      }
    }

    // 2. If no available room, create a new one
    const newRoomId = `room-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const newRoom: GameRoom = {
      id: newRoomId,
      playerSocketIds: new Set(),
      state: createOnlineGameState(), // Use a function to get a fresh game state
    };
    this.rooms.set(newRoomId, newRoom);
    console.log(`Created new room: ${newRoomId}`);
    return newRoom;
  }

  private getRoomById(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  // Helper to get room directly from socket data
  private getPlayerRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): GameRoom | undefined {
    const roomId = socket.data.roomId;
    return roomId ? this.getRoomById(roomId) : undefined;
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
    if (room.state.winner) return socket.emit("error", "Game is already over.");
    if (playerSymbol !== room.state.currentPlayer)
      return socket.emit("error", "Not your turn.");
    if (
      index < 0 ||
      index >= room.state.board.length ||
      room.state.board[index] !== null
    ) {
      return socket.emit("error", "Invalid move.");
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

  // OLD
  //   private handleLogin(socket: any, username: string) {
  //     const roomId = this.matchmaker.findOrCreateRoom();
  //     const room = this.getOrCreateRoom(roomId);

  //     socket.join(roomId);
  //     this.assignPlayer(socket, room, username);

  //     this.io.to(roomId).emit("playerJoined", {
  //       username,
  //       symbol: this.getPlayerSymbol(socket, room),
  //     });

  //     if (room.players.length === 2) {
  //       room.state.gameStatus = GameStatus.ACTIVE;
  //       this.io.to(roomId).emit("gameStart", room.state);
  //     }
  //   }

  private getOrCreateRoom(roomId: string): GameRoom {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        players: [],
        state: createOnlineGameState(),
      });
    }
    return this.rooms.get(roomId)!;
  }

  private assignPlayer(socket: any, room: GameRoom, username: string) {
    const symbol = room.players.length === 0 ? PlayerSymbol.X : PlayerSymbol.O;

    room.state.players[symbol] = {
      username,
      symbol,
      type: PlayerTypes.HUMAN,
      color: PLAYER_CONFIG[symbol].defaultColor,
      isActive: true,
    };

    room.players.push(socket.id);
    socket.emit("playerAssigned", { symbol, roomId: room.id });
  }

  //   private handleMove(socket: any, index: number) {
  //     const room = this.getPlayerRoom(socket);
  //     if (!room || room.state.winner) return;

  //     const playerSymbol = this.getPlayerSymbol(socket, room);
  //     if (playerSymbol !== room.state.currentPlayer) return;

  //     room.state = makeMove(room.state, index);
  //     this.io.to(room.id).emit("gameUpdate", room.state);
  //   }

  //   private getPlayerRoom(socket: any): GameRoom | undefined {
  //     // Using type assertion to tell TypeScript these are strings
  //     const rooms = Array.from(socket.rooms as Set<string>).filter(
  //       (r) => r !== socket.id
  //     );
  //     return rooms.length > 0 ? this.rooms.get(rooms[0]) : undefined;
  //   }

  private getPlayerSymbol(socket: any, room: GameRoom): PlayerSymbol | null {
    // Get player index in the room
    const playerIndex = room.players.indexOf(socket.id);

    // If player is not in room, return null
    if (playerIndex === -1) return null;

    // First player (index 0) is X, second player (index 1) is O
    return playerIndex === 0 ? PlayerSymbol.X : PlayerSymbol.O;
  }

  private handleDisconnect(socket: any) {
    const room = this.getPlayerRoom(socket);
    if (!room) return;

    // Get the player symbol before removing from room
    const playerSymbol = this.getPlayerSymbol(socket, room);

    // Remove player from room
    room.players = room.players.filter((id) => id !== socket.id);

    // Mark player as inactive
    if (playerSymbol !== null) {
      room.state.players[playerSymbol].isActive = false;
    }

    // If room is empty, remove it
    if (room.players.length === 0) {
      this.rooms.delete(room.id);
    } else {
      // Let remaining player know someone left
      this.io.to(room.id).emit("playerLeft", {
        socketId: socket.id,
        symbol: playerSymbol,
      });
    }
  }

  private handleReset(socket: any) {
    const room = this.getPlayerRoom(socket);
    if (!room) return;

    // Store current player data
    const players = room.state.players;

    // Reset game state but keep player info
    room.state = {
      ...createOnlineGameState(),
      players,
    };

    this.io.to(room.id).emit("gameReset", room.state);
  }
}

class Matchmaker {
  private waitingRooms: string[] = [];

  findOrCreateRoom(): string {
    if (this.waitingRooms.length > 0) {
      return this.waitingRooms.pop()!;
    }
    const newRoom = `room-${Date.now()}`;
    this.waitingRooms.push(newRoom);
    return newRoom;
  }
}
