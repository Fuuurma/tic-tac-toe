const { createServer } = require("http");
const { Server } = require("socket.io");
const { io } = require("socket.io-client");

const PlayerSymbol = { X: "X", O: "O" };
const GameStatus = { WAITING: "Waiting", ACTIVE: "active", COMPLETED: "completed" };
const Color = { BLUE: "blue", RED: "red" };
const PlayerTypes = { HUMAN: "HUMAN", COMPUTER: "COMPUTER" };
const GAME_RULES = { MAX_MOVES_PER_PLAYER: 3, BOARD_SIZE: 9 };
const TURN_DURATION_MS = 10000;

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function createInitialGameState(players = {}) {
  return {
    board: Array(GAME_RULES.BOARD_SIZE).fill(null),
    currentPlayer: PlayerSymbol.X,
    winner: null,
    players: {
      [PlayerSymbol.X]: {
        username: players[PlayerSymbol.X]?.username || "",
        color: players[PlayerSymbol.X]?.color || Color.BLUE,
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: !!players[PlayerSymbol.X],
      },
      [PlayerSymbol.O]: {
        username: players[PlayerSymbol.O]?.username || "",
        color: players[PlayerSymbol.O]?.color || Color.RED,
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

function createTestServer(port = 0) {
  return new Promise((resolve, reject) => {
    const httpServer = createServer();
    const ioServer = new Server(httpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    const roomManager = new RoomManager();

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

        const assignedColor = color || Color.BLUE;
        const room = roomManager.findOrCreateRoom();
        const symbol = roomManager.addPlayerToRoom(room, socket.id, username.trim(), assignedColor);
        currentRoom = room;

        socket.join(room.id);

        socket.emit("playerAssigned", {
          symbol,
          roomId: room.id,
          assignedColor,
        });

        const opponent = room.players.size === 2 
          ? Array.from(room.players.entries()).find(([sid]) => sid !== socket.id)
          : null;

        if (opponent) {
          const [oppSid, oppData] = opponent;
          socket.emit("playerJoined", { username: oppData.username, symbol: oppData.symbol });
          ioServer.to(oppSid).emit("playerJoined", { username: username.trim(), symbol });
        }

        if (room.isFull()) {
          room.gameState.gameStatus = GameStatus.ACTIVE;
          ioServer.to(room.id).emit("gameStart", room.gameState);
        }
      });

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
        const opponentSocketId = currentRoom.getOpponentSocket(socket.id);
        roomManager.removePlayerFromRoom(socket.id);

        if (opponentSocketId) {
          ioServer.to(opponentSocketId).emit("playerLeft", { symbol: player.symbol });
        }
        currentRoom = null;
      });

      socket.on("disconnect", () => {
        if (currentRoom) {
          const player = currentRoom.getPlayerBySocket(socket.id);
          const opponentSocketId = currentRoom.getOpponentSocket(socket.id);
          roomManager.removePlayerFromRoom(socket.id);

          if (player && opponentSocketId) {
            ioServer.to(opponentSocketId).emit("playerLeft", { symbol: player.symbol });
          }
          currentRoom = null;
        }
      });
    });

    httpServer.listen(port, () => {
      const actualPort = httpServer.address().port;
      resolve({ ioServer, httpServer, port: actualPort, roomManager });
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
};