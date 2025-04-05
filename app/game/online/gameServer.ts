import { GameRoom } from "@/app/types/types";
import { Server } from "socket.io";
import {
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../constants/constants";
import { makeMove } from "../logic/makeMove";

export class GameServer {
  private io: Server;
  private rooms: Map<string, GameRoom> = new Map();
  private matchmaker = new Matchmaker();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      path: "/api/socket/io",
    });

    this.setupEvents();
  }

  private setupEvents() {
    this.io.on("connection", (socket) => {
      console.log("User connected:", socket.id);

      socket.on("login", (username) => this.handleLogin(socket, username));
      socket.on("disconnect", () => this.handleDisconnect(socket));
      socket.on("move", (index) => this.handleMove(socket, index));
      socket.on("reset", () => this.handleReset(socket));
    });
  }

  private handleLogin(socket: any, username: string) {
    const roomId = this.matchmaker.findOrCreateRoom();
    const room = this.getOrCreateRoom(roomId);

    socket.join(roomId);
    this.assignPlayer(socket, room, username);

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
        state: createGameState(GameModes.ONLINE),
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

  private getPlayerRoom(socket: any): GameRoom | undefined {
    const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    return rooms.length > 0 ? this.rooms.get(rooms[0]) : undefined;
  }

  private handleDisconnect(socket: any) {
    const room = this.getPlayerRoom(socket);
    if (!room) return;

    room.players = room.players.filter((id) => id !== socket.id);
    if (room.players.length === 0) this.rooms.delete(room.id);

    this.io.to(room.id).emit("playerLeft", socket.id);
  }

  private handleReset(socket: any) {
    const room = this.getPlayerRoom(socket);
    if (room) {
      room.state = createGameState(GameModes.ONLINE);
      this.io.to(room.id).emit("gameReset", room.state);
    }
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
