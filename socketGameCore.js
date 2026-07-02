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
const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 20;
const ID_PATTERN = /^[A-Za-z0-9:_-]{4,160}$/;

function sanitizeDisplayName(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DISPLAY_NAME_MAX_LENGTH);
}

function isValidDisplayName(displayName) {
  return displayName.length >= DISPLAY_NAME_MIN_LENGTH && displayName.length <= DISPLAY_NAME_MAX_LENGTH;
}

function normalizeIdentityId(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return ID_PATTERN.test(normalized) ? normalized : undefined;
}

function normalizeLoginPayload(usernameOrPayload, color) {
  if (
    usernameOrPayload &&
    typeof usernameOrPayload === "object" &&
    !Array.isArray(usernameOrPayload)
  ) {
    const displayName = sanitizeDisplayName(
      usernameOrPayload.displayName || usernameOrPayload.username
    );
    const profileId = normalizeIdentityId(usernameOrPayload.profileId);
    const userId = normalizeIdentityId(usernameOrPayload.userId);
    const guestId = normalizeIdentityId(usernameOrPayload.guestId);

    return {
      displayName,
      color: usernameOrPayload.color,
      guestId,
      profileId,
      userId,
      identityKind: profileId || userId ? "account" : "guest",
    };
  }

  return {
    displayName: sanitizeDisplayName(usernameOrPayload),
    color,
    identityKind: "guest",
  };
}

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
      identityKind: player.identityKind,
      guestId: player.guestId,
      profileId: player.profileId,
      userId: player.userId,
    };
  }
  return preservedPlayers;
}

function createInitialGameState(players = {}) {
  return {
    board: Array(GAME_RULES.BOARD_SIZE).fill(null),
    currentPlayer: PlayerSymbol.X,
    winner: null,
    winningCombination: null,
    lastMoveIndex: null,
    players: {
      [PlayerSymbol.X]: {
        username: players[PlayerSymbol.X]?.username || "",
        color: players[PlayerSymbol.X]?.color || DEFAULT_COLORS[PlayerSymbol.X],
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: !!players[PlayerSymbol.X],
        identityKind: players[PlayerSymbol.X]?.identityKind,
        guestId: players[PlayerSymbol.X]?.guestId,
        profileId: players[PlayerSymbol.X]?.profileId,
        userId: players[PlayerSymbol.X]?.userId,
      },
      [PlayerSymbol.O]: {
        username: players[PlayerSymbol.O]?.username || "",
        color: players[PlayerSymbol.O]?.color || DEFAULT_COLORS[PlayerSymbol.O],
        symbol: PlayerSymbol.O,
        type: PlayerTypes.HUMAN,
        isActive: !!players[PlayerSymbol.O],
        identityKind: players[PlayerSymbol.O]?.identityKind,
        guestId: players[PlayerSymbol.O]?.guestId,
        profileId: players[PlayerSymbol.O]?.profileId,
        userId: players[PlayerSymbol.O]?.userId,
      },
    },
    moves: { [PlayerSymbol.X]: [], [PlayerSymbol.O]: [] },
    gameMode: "ONLINE",
    nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
    maxMoves: GAME_RULES.MAX_MOVES_PER_PLAYER,
    moveCount: 0,
    gameStatus: GameStatus.ACTIVE,
    turnTimeRemaining: TURN_DURATION_MS,
  };
}

function getWinnerResult(board, currentPlayer) {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], winningCombination: combination };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return {
      winner: currentPlayer === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X,
      winningCombination: null,
    };
  }
  return { winner: null, winningCombination: null };
}

function checkWinner(board, currentPlayer) {
  return getWinnerResult(board, currentPlayer).winner;
}

function isValidMove(gameState, index, playerSymbol) {
  if (index < 0 || index >= GAME_RULES.BOARD_SIZE) return false;
  if (gameState.board[index] !== null) return false;
  if (gameState.winner) return false;
  if (gameState.currentPlayer !== playerSymbol) return false;
  if (gameState.gameStatus !== GameStatus.ACTIVE) return false;
  return true;
}

function findRandomValidMove(gameState) {
  const validMoves = [];
  for (let index = 0; index < GAME_RULES.BOARD_SIZE; index++) {
    if (isValidMove(gameState, index, gameState.currentPlayer)) {
      validMoves.push(index);
    }
  }

  if (validMoves.length === 0) return null;
  return validMoves[Math.floor(Math.random() * validMoves.length)];
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
  newState.moveCount = gameState.moveCount + 1;

  const winnerResult = getWinnerResult(newState.board, player);
  newState.winner = winnerResult.winner;
  newState.winningCombination = winnerResult.winningCombination;

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

  addPlayer(socketId, identity, color, symbol) {
    const playerIdentity =
      typeof identity === "string"
        ? { displayName: identity, identityKind: "guest" }
        : identity;
    const player = {
      username: playerIdentity.displayName,
      color,
      symbol,
      identityKind: playerIdentity.identityKind,
      guestId: playerIdentity.guestId,
      profileId: playerIdentity.profileId,
      userId: playerIdentity.userId,
    };

    this.players.set(socketId, player);
    this.gameState.players[symbol] = {
      username: player.username,
      color,
      symbol,
      type: PlayerTypes.HUMAN,
      isActive: true,
      identityKind: player.identityKind,
      guestId: player.guestId,
      profileId: player.profileId,
      userId: player.userId,
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
      preservedPlayers[player.symbol] = {
        username: player.username,
        color: player.color,
        identityKind: player.identityKind,
        guestId: player.guestId,
        profileId: player.profileId,
        userId: player.userId,
      };
    }
    this.gameState = createInitialGameState(preservedPlayers);
    this.rematchState = "none";
    this.rematchRequester = null;
    this.rematchDeclined = false;
  }

  tickTurn(deltaMs) {
    if (!this.isFull() || this.gameState.gameStatus !== GameStatus.ACTIVE || this.gameState.winner) {
      return { changed: false, timedOut: false, move: null };
    }

    const currentTime = this.gameState.turnTimeRemaining ?? TURN_DURATION_MS;
    if (currentTime <= 0) {
      return { changed: false, timedOut: false, move: null };
    }

    const nextTime = Math.max(0, currentTime - deltaMs);
    if (nextTime > 0) {
      this.gameState = { ...this.gameState, turnTimeRemaining: nextTime };
      return { changed: true, timedOut: false, move: null };
    }

    const move = findRandomValidMove(this.gameState);
    if (move === null) {
      this.gameState = { ...this.gameState, turnTimeRemaining: 0 };
      return { changed: true, timedOut: true, move: null };
    }

    const nextState = makeMove(this.gameState, move);
    if (!nextState) {
      this.gameState = { ...this.gameState, turnTimeRemaining: 0 };
      return { changed: true, timedOut: true, move: null };
    }

    this.gameState = nextState;
    return { changed: true, timedOut: true, move };
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

  addPlayerToRoom(room, socketId, identity, preferredColor) {
    const symbol = getAvailableSymbol(room);
    const colorResult = resolvePlayerColor(room, symbol, preferredColor);
    room.addPlayer(socketId, identity, colorResult.color, symbol);
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
  findRandomValidMove,
  getWinnerResult,
  isValidDisplayName,
  isValidMove,
  makeMove,
  normalizeLoginPayload,
  sanitizeDisplayName,
  GameRoom,
  RoomManager,
};
