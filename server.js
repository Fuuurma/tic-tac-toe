const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const {
  PlayerSymbol,
  GameStatus,
  GAME_RULES,
  TURN_DURATION_MS,
  createInitialGameState,
  isValidDisplayName,
  isValidMove,
  makeMove,
  normalizeLoginPayload,
  RoomManager,
} = require("./socketGameCore");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const LOG_LEVEL = process.env.LOG_LEVEL || (dev ? "debug" : "info");
const LOG_LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const TURN_TICK_MS = 1000;

function parseSocketCorsOrigin(value) {
  if (!value) return "*";
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) return "*";
  return origins.length === 1 ? origins[0] : origins;
}

function shouldLog(level) {
  return (LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info) >= LOG_LEVELS[level];
}

function log(level, message) {
  if (!shouldLog(level)) return;
  console.log(`[${new Date().toISOString()}] ${message}`);
}

const socketCorsOrigin = parseSocketCorsOrigin(process.env.SOCKET_CORS_ORIGIN);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ============== SERVER SETUP ==============
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: socketCorsOrigin, methods: ["GET", "POST"] },
  });

  const roomManager = new RoomManager();

  setInterval(() => {
    for (const room of roomManager.rooms.values()) {
      const result = room.tickTurn(TURN_TICK_MS);
      if (!result.changed) continue;

      io.to(room.id).emit("gameUpdate", room.gameState);

      if (result.timedOut) {
        const moveLabel = result.move === null ? "no valid move" : `move ${result.move}`;
        log("debug", `Turn timed out in ${room.id}; ${moveLabel}`);
      }

      if (room.gameState.winner) {
        log("info", `Game ended in ${room.id}: ${room.gameState.winner}`);
      }
    }
  }, TURN_TICK_MS);

  // Stats endpoint
  io.of("/stats").on("connection", (socket) => {
    socket.on("getStats", () => {
      socket.emit("stats", roomManager.getStats());
    });
  });

  io.on("connection", (socket) => {
    log("debug", `Client connected: ${socket.id}`);
    let currentRoom = null;

    // ========== LOGIN ==========
    socket.on("login", (usernameOrPayload, color) => {
      const loginPayload = normalizeLoginPayload(usernameOrPayload, color);

      if (!isValidDisplayName(loginPayload.displayName)) {
        socket.emit("error", "Invalid username (max 20 characters)");
        return;
      }

      if (currentRoom) {
        socket.emit("error", "Already logged in");
        return;
      }

      const room = roomManager.findOrCreateRoom();
      const assignment = roomManager.addPlayerToRoom(room, socket.id, loginPayload, loginPayload.color);
      const { symbol, color: assignedColor, wasColorChanged } = assignment;
      currentRoom = room;

      socket.join(room.id);

      log("info", `Player "${loginPayload.displayName}" (${symbol}) joined ${room.id}`);

      socket.emit("playerAssigned", {
        symbol,
        roomId: room.id,
        assignedColor,
      });

      if (wasColorChanged) {
        socket.emit("colorChanged", {
          newColor: assignedColor,
          reason: "Your preferred color was already taken.",
        });
      }

      const opponent = room.getPlayerBySymbol(symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X);
      if (opponent) {
        socket.emit("playerJoined", { username: opponent.username, symbol: opponent.symbol });
        io.to(opponent.socketId).emit("playerJoined", { username: loginPayload.displayName, symbol });
      }

      if (room.isFull()) {
        log("info", `Game starting in ${room.id}`);
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
      log("debug", `Move ${index} by ${player.symbol} in ${currentRoom.id}`);

      io.to(currentRoom.id).emit("gameUpdate", newState);

      if (newState.winner) {
        log("info", `Game ended in ${currentRoom.id}: ${newState.winner}`);
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

      log("info", `Rematch requested by ${player.symbol} in ${currentRoom.id}`);

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
      log("info", `Rematch accepted in ${currentRoom.id}`);

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

      log("info", `Rematch declined by ${player.symbol} in ${currentRoom.id}`);

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
        io.to(result.room.id).emit("playerLeft", {
          symbol: player.symbol,
          gameState: result.room.gameState,
        });
      }

      log("info", `Player ${player.username} left room ${currentRoom?.id || "unknown"}`);
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

      log("info", `Game reset by ${player.username} in ${currentRoom.id}`);
      io.to(currentRoom.id).emit("gameReset", currentRoom.gameState);
    });

    // ========== DISCONNECT ==========
    socket.on("disconnect", (reason) => {
      log("debug", `Client disconnected: ${socket.id} (${reason})`);

      if (currentRoom) {
        const player = currentRoom.getPlayerBySocket(socket.id);
        const opponentSocketId = currentRoom.getOpponentSocket(socket.id);

        roomManager.removePlayerFromRoom(socket.id);

        if (player) {
          log("info", `Player ${player.username} disconnected from ${currentRoom.id}`);
        }

        if (opponentSocketId) {
          io.to(opponentSocketId).emit("playerLeft", {
            symbol: player?.symbol || null,
            gameState: currentRoom.gameState,
          });
        }

        currentRoom = null;
      }
    });
  });

  httpServer.listen(port, () => {
    log("info", `Server ready on http://${hostname}:${port}`);
    log("info", "Socket.IO server running");
  });

  // Periodic stats logging
  setInterval(() => {
    const stats = roomManager.getStats();
    if (stats.totalRooms > 0) {
      log("debug", `Stats: Rooms: ${stats.totalRooms}, Players: ${stats.totalPlayers}, Active: ${stats.activeGames}, Waiting: ${stats.waitingGames}`);
    }
  }, Math.max(30000, TURN_DURATION_MS));
});
