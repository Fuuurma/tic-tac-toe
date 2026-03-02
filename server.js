const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Room management
  const rooms = new Map();
  const playerSockets = new Map();

  // Helper: Find or create a room
  const findOrCreateRoom = () => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.size < 2) {
        return roomId;
      }
    }
    const newRoomId = `room-${Date.now()}`;
    rooms.set(newRoomId, new Set());
    return newRoomId;
  };

  // Helper: Get room size
  const getRoomSize = (roomId) => {
    return rooms.get(roomId)?.size || 0;
  };

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    let currentRoom = null;
    let currentSymbol = null;

    socket.on("login", (username, color) => {
      const roomId = findOrCreateRoom();
      socket.join(roomId);
      currentRoom = roomId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(socket.id);
      playerSockets.set(socket.id, { username, roomId, symbol: null });

      const symbol = getRoomSize(roomId) === 1 ? "X" : "O";
      currentSymbol = symbol;
      playerSockets.get(socket.id).symbol = symbol;

      socket.emit("playerAssigned", {
        symbol,
        roomId,
        assignedColor: color,
      });

      if (getRoomSize(roomId) === 2) {
        io.to(roomId).emit("gameStart", {
          board: Array(9).fill(null),
          players: {
            X: { username: "", color: "BLUE", type: "human" },
            O: { username: "", color: "RED", type: "human" },
          },
          currentPlayer: "X",
          winner: null,
          gameStatus: "active",
          nextToRemove: { X: null, O: null },
        });
      }
    });

    socket.on("move", (index) => {
      if (!currentRoom) return;
      io.to(currentRoom).emit("gameUpdate", { index, symbol: currentSymbol });
    });

    socket.on("reset", () => {
      if (!currentRoom) return;
      io.to(currentRoom).emit("gameReset", {
        board: Array(9).fill(null),
        players: {
          X: { username: "", color: "BLUE", type: "human" },
          O: { username: "", color: "RED", type: "human" },
        },
        currentPlayer: "X",
        winner: null,
        gameStatus: "active",
        nextToRemove: { X: null, O: null },
      });
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            rooms.delete(currentRoom);
          }
        }
        io.to(currentRoom).emit("playerLeft", { symbol: currentSymbol });
      }
      playerSockets.delete(socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO server running on port 3009`);
  });
});
