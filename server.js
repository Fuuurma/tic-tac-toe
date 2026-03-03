const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============== GAME CONSTANTS ==============
const PlayerSymbol = { X: "X", O: "O" };
const GameStatus = { WAITING: "Waiting", ACTIVE: "active", COMPLETED: "completed" };
const Color = {
  BLUE: "blue", GREEN: "green", YELLOW: "yellow", ORANGE: "orange",
  RED: "red", PINK: "pink", PURPLE: "purple", GRAY: "gray",
};
const PlayerTypes = { HUMAN: "HUMAN", COMPUTER: "COMPUTER" };
const GAME_RULES = { MAX_MOVES_PER_PLAYER: 3, BOARD_SIZE: 9 };
const TURN_DURATION_MS = 10000;

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const DEFAULT_COLORS = { [PlayerSymbol.X]: Color.BLUE, [PlayerSymbol.O]: Color.RED };

// ============== GAME LOGIC ==============
function createInitialGameState(players = {}) {
  return {
    board: Array(GAME_RULES.BOARD_SIZE).fill(null),
    currentPlayer: PlayerSymbol.X,
    winner: null,
    players: {
      [PlayerSymbol.X]: {
        username: players[PlayerSymbol.X]?.username || "",
        color: players[PlayerSymbol.X]?.color || DEFAULT_COLORS[PlayerSymbol.X],
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: !!players[PlayerSymbol.X],
      },
      [PlayerSymbol.O]: {
        username: players[PlayerSymbol.O]?.username || "",
        color: players[PlayerSymbol.O]?.color || DEFAULT_COLORS[PlayerSymbol.O],
        symbol: PlayerSymbol.O,
        type: PlayerTypes.HUMAN,
        isActive: !!players[PlayerSymbol.O],
      },
    },
    moves: { [PlayerSymbol.X]: [], [PlayerSymbol.O]: [] },
    gameMode: "ONLINE",
    nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
    maxMoves: GAME_RULES.MAX_MOVES_PER_PLAYER,
    gameStatus: GameStatus.ACTIVE,
    turnTimeRemaining: TURN_DURATION_MS,
  };
}

function checkWinner(board) {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) {
    return "draw";
  }
  return null;
}

function isValidMove(gameState, index, playerSymbol) {
  if (index < 0 || index >= GAME_RULES.BOARD_SIZE) return false;
  if (gameState.board[index] !== null) return false;
  if (gameState.winner) return false;
  if (gameState.currentPlayer !== playerSymbol) return false;
  if (gameState.gameStatus !== GameStatus.ACTIVE) return false;
  return true;
}

function makeMove(gameState, index) {
  if (!isValidMove(gameState, index, gameState.currentPlayer)) {
    return null;
  }

  const newState = JSON.parse(JSON.stringify(gameState));
  const player = newState.currentPlayer;
  const playerMoves = newState.moves[player];

  if (playerMoves.length >= GAME_RULES.MAX_MOVES_PER_PLAYER) {
    const oldestMoveIndex = playerMoves.shift();
    if (oldestMoveIndex !== undefined) {
      newState.board[oldestMoveIndex] = null;
    }
    newState.nextToRemove[player] = null;
  }

  playerMoves.push(index);
  newState.board[index] = player;

  newState.winner = checkWinner(newState.board);

  if (!newState.winner) {
    if (playerMoves.length === GAME_RULES.MAX_MOVES_PER_PLAYER) {
      newState.nextToRemove[player] = playerMoves[0];
    }
    newState.currentPlayer = player === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
    newState.turnTimeRemaining = TURN_DURATION_MS;
  } else {
    newState.gameStatus = GameStatus.COMPLETED;
  }

  return newState;
}

// ============== ROOM MANAGEMENT ==============
class GameRoom {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.gameState = createInitialGameState();
    this.rematchState = "none";
    this.rematchRequester = null;
    this.rematchDeclined = false;
  }

  addPlayer(socketId, username, color, symbol) {
    this.players.set(socketId, { username, color, symbol });
    this.gameState.players[symbol] = {
      username,
      color,
      symbol,
      type: PlayerTypes.HUMAN,
      isActive: true,
    };
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.gameState.players[player.symbol].isActive = false;
      this.gameState.players[player.symbol].username = "";
      this.players.delete(socketId);
    }
    return player;
  }

  isFull() {
    return this.players.size >= 2;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  getPlayerBySocket(socketId) {
    return this.players.get(socketId);
  }

  getPlayerBySymbol(symbol) {
    for (const [socketId, player] of this.players) {
      if (player.symbol === symbol) return { socketId, ...player };
    }
    return null;
  }

  getOpponentSocket(socketId) {
    const player = this.players.get(socketId);
    if (!player) return null;
    const opponentSymbol = player.symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
    for (const [sid, p] of this.players) {
      if (p.symbol === opponentSymbol) return sid;
    }
    return null;
  }

  resetForRematch() {
    const preservedPlayers = {};
    for (const [socketId, player] of this.players) {
      preservedPlayers[player.symbol] = { username: player.username, color: player.color };
    }
    this.gameState = createInitialGameState(preservedPlayers);
    this.rematchState = "none";
    this.rematchRequester = null;
    this.rematchDeclined = false;
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerRooms = new Map();
  }

  findOrCreateRoom() {
    for (const [roomId, room] of this.rooms) {
      if (!room.isFull() && room.rematchState === "none") {
        return room;
      }
    }
    const newRoom = new GameRoom(`room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    this.rooms.set(newRoom.id, newRoom);
    return newRoom;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getPlayerRoom(socketId) {
    return this.playerRooms.get(socketId);
  }

  addPlayerToRoom(room, socketId, username, color) {
    const symbol = room.players.size === 0 ? PlayerSymbol.X : PlayerSymbol.O;
    room.addPlayer(socketId, username, color, symbol);
    this.playerRooms.set(socketId, room);
    return symbol;
  }

  removePlayerFromRoom(socketId) {
    const room = this.playerRooms.get(socketId);
    if (!room) return null;

    const player = room.removePlayer(socketId);
    this.playerRooms.delete(socketId);

    if (room.isEmpty()) {
      this.rooms.delete(room.id);
    }

    return { room, player };
  }

  getStats() {
    let totalPlayers = 0;
    let activeGames = 0;
    let waitingGames = 0;

    for (const room of this.rooms.values()) {
      totalPlayers += room.players.size;
      if (room.isFull()) activeGames++;
      else waitingGames++;
    }

    return { totalRooms: this.rooms.size, totalPlayers, activeGames, waitingGames };
  }
}

// ============== SERVER SETUP ==============
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const roomManager = new RoomManager();

  // Stats endpoint
  io.of("/stats").on("connection", (socket) => {
    socket.on("getStats", () => {
      socket.emit("stats", roomManager.getStats());
    });
  });

  io.on("connection", (socket) => {
    console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);
    let currentRoom = null;

    // ========== LOGIN ==========
    socket.on("login", (username, color) => {
      if (!username || typeof username !== "string" || username.trim().length === 0) {
        socket.emit("error", "Invalid username");
        return;
      }

      if (currentRoom) {
        socket.emit("error", "Already logged in");
        return;
      }

      const assignedColor = color || DEFAULT_COLORS[PlayerSymbol.X];
      const room = roomManager.findOrCreateRoom();
      const symbol = roomManager.addPlayerToRoom(room, socket.id, username.trim(), assignedColor);
      currentRoom = room;

      socket.join(room.id);

      console.log(`[${new Date().toISOString()}] Player "${username}" (${symbol}) joined ${room.id}`);

      socket.emit("playerAssigned", {
        symbol,
        roomId: room.id,
        assignedColor,
      });

      const opponent = room.getPlayerBySymbol(symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X);
      if (opponent) {
        socket.emit("playerJoined", { username: opponent.username, symbol: opponent.symbol });
        io.to(opponent.socketId).emit("playerJoined", { username: username.trim(), symbol });
      }

      if (room.isFull()) {
        console.log(`[${new Date().toISOString()}] Game starting in ${room.id}`);
        room.gameState.gameStatus = GameStatus.ACTIVE;
        io.to(room.id).emit("gameStart", room.gameState);
      }
    });

    // ========== MOVE ==========
    socket.on("move", (index) => {
      if (!currentRoom) {
        socket.emit("error", "Not in a game");
        return;
      }

      const player = currentRoom.getPlayerBySocket(socket.id);
      if (!player) {
        socket.emit("error", "Player not found");
        return;
      }

      if (typeof index !== "number" || index < 0 || index >= GAME_RULES.BOARD_SIZE) {
        socket.emit("error", "Invalid move index");
        return;
      }

      if (!isValidMove(currentRoom.gameState, index, player.symbol)) {
        socket.emit("error", "Invalid move");
        return;
      }

      const newState = makeMove(currentRoom.gameState, index);
      if (!newState) {
        socket.emit("error", "Move failed");
        return;
      }

      currentRoom.gameState = newState;
      console.log(`[${new Date().toISOString()}] Move ${index} by ${player.symbol} in ${currentRoom.id}`);

      io.to(currentRoom.id).emit("gameUpdate", newState);

      if (newState.winner) {
        console.log(`[${new Date().toISOString()}] Game ended in ${currentRoom.id}: ${newState.winner}`);
      }
    });

    // ========== REMATCH ==========
    socket.on("requestRematch", () => {
      if (!currentRoom) {
        socket.emit("error", "Not in a game");
        return;
      }

      const player = currentRoom.getPlayerBySocket(socket.id);
      if (!player) {
        socket.emit("error", "Player not found");
        return;
      }

      if (currentRoom.rematchState !== "none") {
        socket.emit("error", "Rematch already requested");
        return;
      }

      if (currentRoom.rematchDeclined) {
        socket.emit("error", "Rematch was declined");
        return;
      }

      currentRoom.rematchState = "requested";
      currentRoom.rematchRequester = player.symbol;

      console.log(`[${new Date().toISOString()}] Rematch requested by ${player.symbol} in ${currentRoom.id}`);

      const opponentSocketId = currentRoom.getOpponentSocket(socket.id);
      if (opponentSocketId) {
        io.to(opponentSocketId).emit("rematchRequested", { requesterSymbol: player.symbol });
      }
    });

    socket.on("acceptRematch", () => {
      if (!currentRoom) {
        socket.emit("error", "Not in a game");
        return;
      }

      const player = currentRoom.getPlayerBySocket(socket.id);
      if (!player) {
        socket.emit("error", "Player not found");
        return;
      }

      if (currentRoom.rematchState !== "requested") {
        socket.emit("error", "No rematch requested");
        return;
      }

      if (currentRoom.rematchRequester === player.symbol) {
        socket.emit("error", "Cannot accept your own rematch request");
        return;
      }

      currentRoom.resetForRematch();
      console.log(`[${new Date().toISOString()}] Rematch accepted in ${currentRoom.id}`);

      io.to(currentRoom.id).emit("gameReset", currentRoom.gameState);
    });

    socket.on("declineRematch", () => {
      if (!currentRoom) {
        socket.emit("error", "Not in a game");
        return;
      }

      const player = currentRoom.getPlayerBySocket(socket.id);
      if (!player) {
        socket.emit("error", "Player not found");
        return;
      }

      currentRoom.rematchDeclined = true;
      currentRoom.rematchState = "none";
      currentRoom.rematchRequester = null;

      console.log(`[${new Date().toISOString()}] Rematch declined by ${player.symbol} in ${currentRoom.id}`);

      io.to(currentRoom.id).emit("error", `Rematch declined by ${player.username}`);
    });

    // ========== LEAVE ROOM ==========
    socket.on("leaveRoom", () => {
      if (!currentRoom) {
        socket.emit("error", "Not in a game");
        return;
      }

      const player = currentRoom.getPlayerBySocket(socket.id);
      if (!player) return;

      socket.leave(currentRoom.id);
      const opponentSocketId = currentRoom.getOpponentSocket(socket.id);

      const result = roomManager.removePlayerFromRoom(socket.id);

      if (result && result.room) {
        io.to(result.room.id).emit("playerLeft", { symbol: player.symbol });
      }

      console.log(`[${new Date().toISOString()}] Player ${player.username} left room ${currentRoom?.id || "unknown"}`);
      currentRoom = null;
    });

    // ========== RESET (Admin) ==========
    socket.on("reset", () => {
      if (!currentRoom) {
        socket.emit("error", "Not in a game");
        return;
      }

      const player = currentRoom.getPlayerBySocket(socket.id);
      if (!player) return;

      const preservedPlayers = {};
      for (const [sid, p] of currentRoom.players) {
        preservedPlayers[p.symbol] = { username: p.username, color: p.color };
      }
      currentRoom.gameState = createInitialGameState(preservedPlayers);
      currentRoom.rematchState = "none";
      currentRoom.rematchRequester = null;

      console.log(`[${new Date().toISOString()}] Game reset by ${player.username} in ${currentRoom.id}`);
      io.to(currentRoom.id).emit("gameReset", currentRoom.gameState);
    });

    // ========== DISCONNECT ==========
    socket.on("disconnect", (reason) => {
      console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id} (${reason})`);

      if (currentRoom) {
        const player = currentRoom.getPlayerBySocket(socket.id);
        const opponentSocketId = currentRoom.getOpponentSocket(socket.id);

        roomManager.removePlayerFromRoom(socket.id);

        if (player) {
          console.log(`[${new Date().toISOString()}] Player ${player.username} disconnected from ${currentRoom.id}`);
        }

        if (opponentSocketId) {
          io.to(opponentSocketId).emit("playerLeft", { symbol: player?.symbol || null });
        }

        currentRoom = null;
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`[${new Date().toISOString()}] Server ready on http://${hostname}:${port}`);
    console.log(`[${new Date().toISOString()}] Socket.IO server running`);
  });

  // Periodic stats logging
  setInterval(() => {
    const stats = roomManager.getStats();
    if (stats.totalRooms > 0) {
      console.log(`[Stats] Rooms: ${stats.totalRooms}, Players: ${stats.totalPlayers}, Active: ${stats.activeGames}, Waiting: ${stats.waitingGames}`);
    }
  }, 30000);
});