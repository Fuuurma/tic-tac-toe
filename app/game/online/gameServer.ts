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

  private startGame(room: GameRoom): void {
    if (room.playerSocketIds.size !== 2) {
      console.warn(
        `Attempted to start game in room ${room.id} with ${room.playerSocketIds.size} players.`
      );
      return;
    }
    room.state.gameStatus = GameStatus.ACTIVE;
    room.state.currentPlayer = PlayerSymbol.X; // Or randomize starting player
    console.log(`Game starting in room ${room.id}`);
    this.io.to(room.id).emit(Events.GAME_START, room.state);
  }

  // Resets the board state, keeps players, prepares for new game
  private resetRoomForRematch(room: GameRoom): void {
    const currentPlayersData = { ...room.state.players };

    // Reset game state but keep player info
    room.state = {
      ...createOnlineGameState(),
      players: currentPlayersData,
      gameStatus: GameStatus.ACTIVE, // Start immediately
      currentPlayer: PlayerSymbol.X, // Or swap starter?
    };

    // Ensure players are marked active
    Array.from(room.playerSocketIds).forEach((socketId) => {
      const playerSocket = this.io.sockets.sockets.get(socketId);
      if (playerSocket?.data.symbol) {
        room.state.players[playerSocket.data.symbol].isActive = true;
      }
    });

    // Reset rematch tracking state
    room.rematchState = "none";
    room.rematchRequesterSymbol = null;

    console.log(`Game reset for rematch in room ${room.id}.`);
    this.io.to(room.id).emit(Events.GAME_RESET, room.state); // Notify clients game is reset
  }

  private notifyRoom(
    roomId: string,
    event: keyof ServerToClientEvents,
    payload?: any
  ): void {
    this.io.to(roomId).emit(event, payload);
  }

  private leaveRoomAndDeleteIfEmpty(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    room: GameRoom
  ): void {
    const roomId = room.id;
    const playerSymbol = socket.data.symbol;

    console.log(
      `Player ${socket.data.username || socket.id} leaving room ${roomId}`
    );
    socket.leave(roomId);
    room.playerSocketIds.delete(socket.id);

    // Mark player inactive
    if (playerSymbol) {
      room.state.players[playerSymbol].isActive = false;
    }
    // Reset rematch state if someone leaves
    room.rematchState = "none";
    room.rematchRequesterSymbol = null;

    // Update status (could be WAITING or even a custom state like ABANDONED)
    room.state.gameStatus = GameStatus.WAITING;

    if (room.playerSocketIds.size === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} is empty, deleting.`);
    } else {
      // Notify remaining player
      const opponentSocket = this.getOpponentSocket(socket, room);
      if (opponentSocket) {
        opponentSocket.emit(Events.PLAYER_LEFT, {
          symbol: playerSymbol || null,
        });
        opponentSocket.emit(Events.GAME_UPDATE, room.state); // Send updated state
        console.log(
          `Notified remaining player in room ${roomId} about disconnect.`
        );
      }
    }

    // Clear socket data
    socket.data = {};
  }

  // Validates a move attempt
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

  // --- Event Handlers ---

  private handleLogin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>,
    username: string,
    preferredColor: Color
  ): void {
    // Basic validation
    if (!username?.trim())
      return socket.emit(Events.ERROR, "Invalid username.");
    if (socket.data.roomId)
      return socket.emit(Events.ERROR, "Already in a room.");

    const room = this.findAvailableRoomOrCreate();
    const roomId = room.id;
    const isFirstPlayer = room.playerSocketIds.size === 0;
    const symbol = isFirstPlayer ? PlayerSymbol.X : PlayerSymbol.O;

    // Determine final color, checking for conflicts ONLY if second player
    let finalColor = preferredColor;
    let colorWasChanged = false;
    if (!isFirstPlayer) {
      const assignedColor = this.assignPlayerColor(
        room,
        symbol,
        preferredColor
      );
      if (assignedColor !== preferredColor) {
        colorWasChanged = true;
        finalColor = assignedColor;
        // Notify the player immediately that their color was changed
        socket.emit(Events.COLOR_CHANGED, {
          newColor: finalColor,
          reason: "Color already taken by opponent.",
        });
      }
    } else {
      finalColor = preferredColor || PLAYER_CONFIG[symbol].defaultColor;
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
    // Validation passed, room and playerSymbol are defined here
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

  // --- Rematch and Leave Handlers ---

  private handleRequestRematch(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, SocketData>
  ): void {
    const room = this.getPlayerRoom(socket);
    const requesterSymbol = socket.data.symbol;

    if (!room || !requesterSymbol)
      return socket.emit(Events.ERROR, "Invalid request.");
    if (room.state.gameStatus !== GameStatus.COMPLETED)
      return socket.emit(Events.ERROR, "Game not finished yet.");
    if (room.playerSocketIds.size < 2)
      return socket.emit(Events.ERROR, "Opponent is not present.");
    if (room.rematchState === "requested")
      return socket.emit(Events.ERROR, "Rematch already requested."); // Prevent spamming

    room.rematchState = "requested";
    room.rematchRequesterSymbol = requesterSymbol;

    console.log(
      `Player ${requesterSymbol} requested rematch in room ${room.id}`
    );

    // Notify the opponent
    const opponentSocket = this.getOpponentSocket(socket, room);
    opponentSocket?.emit(Events.REMATCH_REQUESTED, { requesterSymbol });

    // Notify requester (optional confirmation)
    // socket.emit('status', 'Rematch requested. Waiting for opponent...');
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
