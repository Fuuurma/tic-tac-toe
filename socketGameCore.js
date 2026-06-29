const PlayerSymbol = { X: "X", O: "O" };
const GameStatus = { WAITING: "Waiting", ACTIVE: "active", COMPLETED: "completed" };
const Color = {
  BLUE: "blue",
  GREEN: "green",
  YELLOW: "yellow",
  ORANGE: "orange",
  RED: "red",
  PINK: "pink",
  PURPLE: "purple",
  GRAY: "gray",
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
const AVAILABLE_COLORS = Object.values(Color);

function normalizeColor(color, symbol) {
  return AVAILABLE_COLORS.includes(color) ? color : DEFAULT_COLORS[symbol];
}

function resolvePlayerColor(room, symbol, preferredColor) {
  const normalizedColor = normalizeColor(preferredColor, symbol);
  const opponentSymbol = symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  const opponentColor = room.gameState.players[opponentSymbol]?.isActive
    ? room.gameState.players[opponentSymbol].color
    : null;

  if (!opponentColor || normalizedColor !== opponentColor) {
    return { color: normalizedColor, wasChanged: normalizedColor !== preferredColor };
  }

  const fallbackColor =
    DEFAULT_COLORS[symbol] !== opponentColor
      ? DEFAULT_COLORS[symbol]
      : AVAILABLE_COLORS.find((availableColor) => availableColor !== opponentColor);

  return {
    color: fallbackColor || normalizedColor,
    wasChanged: true,
  };
}

function getAvailableSymbol(room) {
  return room.getPlayerBySymbol(PlayerSymbol.X) ? PlayerSymbol.O : PlayerSymbol.X;
}

function getPreservedPlayers(players) {
  const preservedPlayers = {};
  for (const player of players.values()) {
    preservedPlayers[player.symbol] = {
      username: player.username,
      color: player.color,
    };
  }
  return preservedPlayers;
}

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

function checkWinner(board, currentPlayer) {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) {
    return currentPlayer === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
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
  newState.lastMoveIndex = index;

  newState.winner = checkWinner(newState.board, player);

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

    if (this.isEmpty()) {
      this.gameState = createInitialGameState();
      this.rematchState = "none";
      this.rematchRequester = null;
      this.rematchDeclined = false;
    } else if (player) {
      this.gameState = createInitialGameState(getPreservedPlayers(this.players));
      this.gameState.gameStatus = GameStatus.WAITING;
      this.rematchState = "none";
      this.rematchRequester = null;
      this.rematchDeclined = false;
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
    for (const player of this.players.values()) {
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
    for (const room of this.rooms.values()) {
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

  addPlayerToRoom(room, socketId, username, preferredColor) {
    const symbol = getAvailableSymbol(room);
    const colorResult = resolvePlayerColor(room, symbol, preferredColor);
    room.addPlayer(socketId, username, colorResult.color, symbol);
    this.playerRooms.set(socketId, room);
    return { symbol, color: colorResult.color, wasColorChanged: colorResult.wasChanged };
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

module.exports = {
  PlayerSymbol,
  GameStatus,
  Color,
  PlayerTypes,
  GAME_RULES,
  TURN_DURATION_MS,
  createInitialGameState,
  isValidMove,
  makeMove,
  GameRoom,
  RoomManager,
};
