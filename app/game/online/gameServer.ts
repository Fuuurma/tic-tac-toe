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

  // OLD
  private handleLogin(socket: any, username: string) {
    const roomId = this.matchmaker.findOrCreateRoom();
    const room = this.getOrCreateRoom(roomId);

    socket.join(roomId);
    this.assignPlayer(socket, room, username);

    this.io.to(roomId).emit("playerJoined", {
      username,
      symbol: this.getPlayerSymbol(socket, room),
    });

    if (room.players.length === 2) {
      room.state.gameStatus = GameStatus.ACTIVE;
      this.io.to(roomId).emit("gameStart", room.state);
    }
  }

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

  private handleMove(socket: any, index: number) {
    const room = this.getPlayerRoom(socket);
    if (!room || room.state.winner) return;

    const playerSymbol = this.getPlayerSymbol(socket, room);
    if (playerSymbol !== room.state.currentPlayer) return;

    room.state = makeMove(room.state, index);
    this.io.to(room.id).emit("gameUpdate", room.state);
  }

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
