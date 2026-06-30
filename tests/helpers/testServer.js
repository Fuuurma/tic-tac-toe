/* eslint-disable @typescript-eslint/no-require-imports */

const { createServer } = require("http");
const { Server } = require("socket.io");
const { io } = require("socket.io-client");
const {
  PlayerSymbol,
  GameStatus,
  Color,
  GAME_RULES,
  TURN_DURATION_MS,
  isValidMove,
  makeMove,
  RoomManager,
} = require("../../socketGameCore");

const DEBUG_TEST_SERVER = process.env.DEBUG_TEST_SERVER === "1";

function testLog(message) {
  if (DEBUG_TEST_SERVER) {
    console.log(message);
  }
}

function createTestServer(port = 0, options = {}) {
  return new Promise((resolve) => {
    const httpServer = createServer();
    const ioServer = new Server(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    const roomManager = new RoomManager();
    const turnTimerIntervalMs = options.turnTimerIntervalMs ?? null;
    const turnTimerStepMs = options.turnTimerStepMs ?? turnTimerIntervalMs;
    let turnTimer = null;

    if (turnTimerIntervalMs && turnTimerStepMs) {
      turnTimer = setInterval(() => {
        for (const room of roomManager.rooms.values()) {
          const result = room.tickTurn(turnTimerStepMs);
          if (result.changed) {
            ioServer.to(room.id).emit("gameUpdate", room.gameState);
          }
        }
      }, turnTimerIntervalMs);
    }

    const stopTurnTimer = () => {
      if (turnTimer) {
        clearInterval(turnTimer);
        turnTimer = null;
      }
    };

    httpServer.on("close", stopTurnTimer);

    ioServer.on("connection", (socket) => {
      let currentRoom = null;

      socket.on("login", (username, color) => {
        if (!username || typeof username !== "string" || username.trim().length === 0) {
          socket.emit("error", "Invalid username");
          return;
        }

        if (currentRoom) {
          socket.emit("error", "Already logged in");
          return;
        }

        const room = roomManager.findOrCreateRoom();
        const assignment = roomManager.addPlayerToRoom(room, socket.id, username.trim(), color);
        const { symbol, color: assignedColor, wasColorChanged } = assignment;
        currentRoom = room;

        socket.join(room.id);

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

        const opponent = room.getPlayerBySymbol(
          symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X
        );

        if (opponent) {
          socket.emit("playerJoined", { username: opponent.username, symbol: opponent.symbol });
          ioServer.to(opponent.socketId).emit("playerJoined", { username: username.trim(), symbol });
        }

        if (room.isFull()) {
          room.gameState.gameStatus = GameStatus.ACTIVE;
          ioServer.to(room.id).emit("gameStart", room.gameState);
        }
      });

      socket.on("move", (index) => {
        testLog(`[TestServer] Move event from ${socket.id} for index ${index}`);
        if (!currentRoom) {
          testLog("[TestServer] Move failed: Not in a game");
          socket.emit("error", "Not in a game");
          return;
        }

        const player = currentRoom.getPlayerBySocket(socket.id);
        if (!player) {
          testLog("[TestServer] Move failed: Player not found");
          socket.emit("error", "Player not found");
          return;
        }

        if (typeof index !== "number" || index < 0 || index >= GAME_RULES.BOARD_SIZE) {
          testLog(`[TestServer] Move failed: Invalid index ${index}`);
          socket.emit("error", "Invalid move index");
          return;
        }

        if (!isValidMove(currentRoom.gameState, index, player.symbol)) {
          testLog(`[TestServer] Move failed: isValidMove returned false for ${player.symbol} at ${index}`);
          testLog(`[TestServer] Current board: ${JSON.stringify(currentRoom.gameState.board)}`);
          testLog(`[TestServer] Current player: ${currentRoom.gameState.currentPlayer}`);
          socket.emit("error", "Invalid move");
          return;
        }

        const newState = makeMove(currentRoom.gameState, index);
        if (!newState) {
          testLog("[TestServer] Move failed: makeMove returned null");
          socket.emit("error", "Move failed");
          return;
        }

        currentRoom.gameState = newState;
        testLog(`[TestServer] Move success. Broadcasting gameUpdate to room ${currentRoom.id}`);
        ioServer.to(currentRoom.id).emit("gameUpdate", newState);
      });

      socket.on("requestRematch", () => {
        if (!currentRoom) return;
        const player = currentRoom.getPlayerBySocket(socket.id);
        if (!player) return;

        currentRoom.rematchState = "requested";
        currentRoom.rematchRequester = player.symbol;

        const opponentSocketId = currentRoom.getOpponentSocket(socket.id);
        if (opponentSocketId) {
          ioServer.to(opponentSocketId).emit("rematchRequested", { requesterSymbol: player.symbol });
        }
      });

      socket.on("acceptRematch", () => {
        if (!currentRoom) return;
        const player = currentRoom.getPlayerBySocket(socket.id);
        if (!player) return;

        currentRoom.resetForRematch();
        ioServer.to(currentRoom.id).emit("gameReset", currentRoom.gameState);
      });

      socket.on("declineRematch", () => {
        if (!currentRoom) return;
        const player = currentRoom.getPlayerBySocket(socket.id);
        if (!player) return;

        currentRoom.rematchDeclined = true;
        currentRoom.rematchState = "none";
        ioServer.to(currentRoom.id).emit("error", `Rematch declined by ${player.username}`);
      });

      socket.on("leaveRoom", () => {
        if (!currentRoom) return;
        const player = currentRoom.getPlayerBySocket(socket.id);
        if (!player) return;

        socket.leave(currentRoom.id);
        const result = roomManager.removePlayerFromRoom(socket.id);

        if (result && result.room) {
          ioServer.to(result.room.id).emit("playerLeft", {
            symbol: player.symbol,
            gameState: result.room.gameState,
          });
        }
        currentRoom = null;
      });

      socket.on("disconnect", () => {
        if (currentRoom) {
          const player = currentRoom.getPlayerBySocket(socket.id);
          const opponentSocketId = currentRoom.getOpponentSocket(socket.id);
          roomManager.removePlayerFromRoom(socket.id);

          if (player && opponentSocketId) {
            ioServer.to(opponentSocketId).emit("playerLeft", {
              symbol: player.symbol,
              gameState: currentRoom.gameState,
            });
          }
          currentRoom = null;
        }
      });
    });

    httpServer.listen(port, () => {
      const actualPort = httpServer.address().port;
      resolve({ ioServer, httpServer, port: actualPort, roomManager, stopTurnTimer });
    });
  });
}

function createClient(url) {
  return io(url, {
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
  });
}

module.exports = {
  createTestServer,
  createClient,
  PlayerSymbol,
  GameStatus,
  Color,
  GAME_RULES,
  TURN_DURATION_MS,
};
