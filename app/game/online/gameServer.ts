import { GameRoom } from "@/app/types/types";
import { Server } from "socket.io";

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
}
