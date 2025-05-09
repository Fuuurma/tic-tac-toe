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
import { isValidPlayerSymbol } from "@/app/utils/isValidSymbol";
import { RoomManager } from "./roomManager";
import { prepareRoomForRematch } from "./utils/prepareRoomRematch";
import { determinePlayerColor } from "@/app/utils/colors/determinePlayerColor";
import { getStartingPlayer } from "@/app/utils/getStartingPlayer";

type ValidationResult = { isValid: true } | { isValid: false; error: string };

export class GameServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents, SocketData>;
  private rooms: Map<string, GameRoom> = new Map();
  private roomManager: RoomManager;

  constructor(server: any) {
    this.io = new Server(server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      // If running on a separate port, path might not be needed depending on client connection
      // path: "/api/socket/io", // Keep if attaching to Next.js server on default port
    });

    this.roomManager = new RoomManager();
    this.setupEvents();
    console.log("GameServer initialized");
  }

  // --- SETUP  --- //

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
    socket.on(Events.REQUEST_REMATCH, () => this.handleRequestRematch(socket));
    socket.on(Events.ACCEPT_REMATCH, () => this.handleAcceptRematch(socket));
    socket.on(Events.DECLINE_REMATCH, () => this.handleDeclineRematch(socket));
    socket.on(Events.LEAVE_ROOM, () => this.handleLeaveRoom(socket));

    socket.on("error", (err) => {
      console.error(`Socket ${socket.id} error: ${err.message}`);
    });
  }

  // --- HELPER FUNCTIONS --- //

  private getPlayerRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): GameRoom | undefined {
    const roomId = socket.data.roomId;
    return roomId ? this.roomManager.getRoomById(roomId) : undefined;
  }

  private getSocketFromId(socketId: string): Socket | undefined {
    return this.io.sockets.sockets.get(socketId);
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

  private startGame(room: GameRoom): void {
    if (room.playerSocketIds.size !== 2) {
      console.warn(
        `Attempted to start game in room ${room.id} with ${room.playerSocketIds.size} players.`
      );
      return;
    }

    room.state.gameStatus = GameStatus.ACTIVE;
    room.state.currentPlayer = getStartingPlayer();

    console.log(`Game starting in room ${room.id}`);
    this.io.to(room.id).emit(Events.GAME_START, room.state);
  }

  private resetRoomForRematch(room: GameRoom): void {
    prepareRoomForRematch(room, room.playerSocketIds, (socketId) =>
      this.getSocketFromId(socketId)
    );

    console.log(`Game reset for rematch in room ${room.id}.`);
    this.io.to(room.id).emit(Events.GAME_RESET, room.state);
  }

  private notifyRoom(
    roomId: string,
    event: keyof ServerToClientEvents,
    payload?: any
  ): void {
    this.io.to(roomId).emit(event, payload);
  }

  // -- PLAYER LEAVES ACTIONS --- //
  // Main logic for handling player leaving/disconnecting
  private playerLeaveActions(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    room: GameRoom
  ): void {
    const roomId = room.id;
    const playerSymbol = socket.data.symbol;

    console.log(
      `Processing leave for ${
        socket.data.username || socket.id
      } from room ${roomId}`
    );
    socket.leave(roomId);
    room.playerSocketIds.delete(socket.id);

    // Mark player inactive in state
    if (isValidPlayerSymbol(playerSymbol)) {
      room.state.players[playerSymbol].isActive = false;
    }
    // Reset rematch state
    room.rematchState = "none";
    room.rematchRequesterSymbol = null;
    // Update game status
    room.state.gameStatus = GameStatus.WAITING;

    // Delete room if empty, otherwise notify opponent
    if (room.playerSocketIds.size === 0) {
      this.roomManager.deleteRoom(roomId);
    } else {
      const opponentSocket = this.getOpponentSocket(socket, room);
      if (opponentSocket) {
        opponentSocket.emit(Events.PLAYER_LEFT, {
          symbol: playerSymbol || null,
        });
        opponentSocket.emit(Events.GAME_UPDATE, room.state);
        console.log(
          `Notified remaining player in room ${roomId} about player leaving.`
        );
      }
    }

    socket.data = {};
  }

  // --- LOGIN --- //

  private handleLogin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    username: string,
    preferredColor: Color
  ): void {
    // Basic validation
    if (!username?.trim()) {
      socket.emit(Events.ERROR, "Invalid username.");
      return;
    }
    if (socket.data.roomId) {
      socket.emit(Events.ERROR, "Already in a room.");
      return;
    }

    const room = this.roomManager.findAvailableRoomOrCreate();
    const roomId = room.id;
    const isFirstPlayer = room.playerSocketIds.size === 0;
    const symbol = isFirstPlayer ? PlayerSymbol.X : PlayerSymbol.O;

    // Get opponent data if second player
    const opponentSymbol = isFirstPlayer ? PlayerSymbol.O : PlayerSymbol.X;
    const opponentData = room.state.players[opponentSymbol];

    // Determine final color using our helper function
    const { finalColor, wasChanged } = determinePlayerColor(
      symbol,
      opponentData,
      preferredColor
    );

    // Notify the player if their color was changed
    if (wasChanged) {
      socket.emit(Events.COLOR_CHANGED, {
        newColor: finalColor,
        reason: "Color already taken by opponent.",
      });
    }

    // Store data on socket
    socket.data = { username, roomId, symbol };
    socket.join(roomId);
    room.playerSocketIds.add(socket.id);

    // Update GameState
    room.state.players[symbol] = {
      username,
      symbol,
      type: PlayerTypes.HUMAN,
      color: finalColor,
      isActive: true,
    };

    console.log(
      `Player ${username}(${socket.id}) joined room ${roomId} as ${symbol} with color ${finalColor}`
    );

    // Notify player of assignment (including final color)
    socket.emit(Events.PLAYER_ASSIGNED, {
      symbol,
      roomId,
      assignedColor: finalColor,
    });

    // Notify opponent (if exists)
    const opponentSocket = this.getOpponentSocket(socket, room);
    if (opponentSocket) {
      opponentSocket.emit(Events.PLAYER_JOINED, { username, symbol });
      // If opponent joined, update *their* game state view with the new player's info too
      opponentSocket.emit(Events.GAME_UPDATE, room.state);
    }

    // Start game or wait
    if (room.playerSocketIds.size === 2) {
      this.startGame(room);
    } else {
      room.state.gameStatus = GameStatus.WAITING;
      socket.emit(Events.GAME_UPDATE, room.state); // Send initial state to first player
      console.log(`Room ${roomId} waiting for opponent.`);
    }
  }

  // --- MOVE VALIDATION --- //

  private validateMove(
    room: GameRoom | undefined,
    playerSymbol: PlayerSymbol | undefined,
    index: number
  ): ValidationResult {
    if (!room) return { isValid: false, error: "Not in a valid room." };
    if (!playerSymbol)
      return { isValid: false, error: "Player symbol not assigned." };
    if (room.state.gameStatus !== GameStatus.ACTIVE)
      return { isValid: false, error: "Game is not active." };
    if (room.state.winner)
      return { isValid: false, error: "Game is already over." };
    if (playerSymbol !== room.state.currentPlayer)
      return { isValid: false, error: "Not your turn." };
    if (
      index < 0 ||
      index >= room.state.board.length ||
      room.state.board[index] !== null
    ) {
      return { isValid: false, error: "Invalid move location." };
    }
    return { isValid: true };
  }

  // --- HANDLE MOVE --- //

  private handleMove(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    index: number
  ): void {
    const room = this.getPlayerRoom(socket);
    const playerSymbol = socket.data.symbol;

    const validation = this.validateMove(room, playerSymbol, index);
    if (!validation.isValid) {
      socket.emit(Events.ERROR, validation.error);
      return;
    }

    const currentRoom = room!;
    const currentSymbol = playerSymbol!;

    console.log(
      `Player ${currentSymbol} in room ${currentRoom.id} attempts move at index ${index}`
    );

    try {
      currentRoom.state = makeMove(currentRoom.state, index); // Update state
      console.log(
        `Move successful in room ${currentRoom.id}. New current player: ${currentRoom.state.currentPlayer}`
      );

      // Check for winner/draw
      if (currentRoom.state.winner) {
        currentRoom.state.gameStatus = GameStatus.COMPLETED; // Use a distinct 'completed' status
        console.log(
          `Game finished in room ${currentRoom.id}. Winner: ${currentRoom.state.winner}`
        );
      }

      // Broadcast updated state regardless of game end
      this.notifyRoom(currentRoom.id, Events.GAME_UPDATE, currentRoom.state);
    } catch (error: any) {
      console.error(
        `Error during move in room ${currentRoom.id}: ${error.message}`
      );
      socket.emit(
        Events.ERROR,
        `Move failed: ${error.message || "Unknown error"}`
      );
    }
  }

  // --- REMATCH HANDLERS ---

  private validateRematchRequest(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    room: GameRoom | undefined
  ): ValidationResult {
    const requesterSymbol = socket.data.symbol;

    if (!room || !requesterSymbol)
      return { isValid: false, error: "Invalid request context." };

    if (room.state.gameStatus !== GameStatus.COMPLETED)
      return { isValid: false, error: "Game not finished yet." };

    if (room.playerSocketIds.size < 2)
      return { isValid: false, error: "Opponent is not present." };

    if (room.rematchState === "requested")
      return { isValid: false, error: "Rematch already requested." };

    return { isValid: true };
  }

  private handleRequestRematch(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const room = this.getPlayerRoom(socket);

    const validation = this.validateRematchRequest(socket, room);
    if (!validation.isValid) {
      socket.emit(Events.ERROR, validation.error);
      return;
    }

    const currentRoom = room!;
    const requesterSymbol = socket.data.symbol!;

    currentRoom.rematchState = "requested";
    currentRoom.rematchRequesterSymbol = requesterSymbol;

    console.log(
      `Player ${requesterSymbol} requested rematch in room ${currentRoom.id}`
    );

    this.getOpponentSocket(socket, currentRoom)?.emit(
      Events.REMATCH_REQUESTED,
      { requesterSymbol }
    );

    // Notify requester (optional confirmation)
    // socket.emit('status', 'Rematch requested. Waiting for opponent...');
  }

  private validateRematchAccept(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    room: GameRoom | undefined
  ): ValidationResult {
    const accepterSymbol = socket.data.symbol;

    if (!room || !accepterSymbol)
      return { isValid: false, error: "Invalid request context." };

    if (room.rematchState !== "requested")
      return { isValid: false, error: "No rematch request pending." };

    if (room.rematchRequesterSymbol === accepterSymbol)
      return { isValid: false, error: "Cannot accept your own request." };

    if (!room.playerSocketIds.has(socket.id))
      return { isValid: false, error: "Player not in this room." }; // Extra check

    return { isValid: true };
  }

  private handleAcceptRematch(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const room = this.getPlayerRoom(socket);

    const validation = this.validateRematchAccept(socket, room);
    if (!validation.isValid) {
      socket.emit(Events.ERROR, validation.error);
      return;
    }

    const currentRoom = room!;
    const accepterSymbol = socket.data.symbol!;

    console.log(
      `Player ${accepterSymbol} accepted rematch in room ${currentRoom.id}`
    );

    this.resetRoomForRematch(currentRoom);
  }

  private handleDeclineRematch(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const room = this.getPlayerRoom(socket);
    const declinerSymbol = socket.data.symbol;

    if (!room || !declinerSymbol) {
      socket.emit(Events.ERROR, "Invalid request.");
      return;
    }
    // Check if there was a request to decline
    if (room.rematchState !== "requested") return; // Ignore if no request pending

    console.log(`Player ${declinerSymbol} declined rematch in room ${room.id}`);

    // Notify the original requester
    const requesterSocket = Array.from(room.playerSocketIds)
      .map((id) => this.io.sockets.sockets.get(id))
      .find((s) => s?.data.symbol === room.rematchRequesterSymbol);

    requesterSocket?.emit(Events.ERROR, "Opponent declined the rematch."); // Use error or a specific event

    // Reset rematch state
    room.rematchState = "none";
    room.rematchRequesterSymbol = null;
    // Optional: Automatically make the decliner leave the room? Or let them choose 'Leave Room' separately.
    // this.handleLeaveRoom(socket);
  }

  // --- LEAVE HANDLERS --- //

  private handleLeaveRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const room = this.getPlayerRoom(socket);
    if (room) {
      this.playerLeaveActions(socket, room);
    } else {
      // If not in a room (maybe already left), just ensure data is clear
      socket.data = {};
    }
  }

  private handleDisconnect(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const username = socket.data.username || socket.id;
    console.log(`User disconnected: ${username} (${socket.id})`);
    const room = this.getPlayerRoom(socket);
    if (room) {
      // Use the same leave logic as explicit leave
      this.playerLeaveActions(socket, room);
    }
  }
}
