import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  Color,
  GAME_RULES,
  GameMode,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerType,
  PlayerTypes,
  TURN_DURATION_MS,
  WINNING_COMBINATIONS,
} from "./constants";

export type CellValue = PlayerSymbol | null;
export type Board = CellValue[];

export interface PlayerConfig {
  username: string;
  color: Color;
  symbol: PlayerSymbol;
  type: PlayerType;
  isActive: boolean;
  lastMoveAt?: number;
}

export interface GameState {
  board: Board;
  currentPlayer: PlayerSymbol;
  winner: PlayerSymbol | null;
  winningCombination: readonly [number, number, number] | null;
  lastMoveIndex: number | null;
  players: Record<PlayerSymbol, PlayerConfig>;
  moves: Record<PlayerSymbol, number[]>;
  gameMode: GameMode;
  nextToRemove: Record<PlayerSymbol, number | null>;
  maxMoves: number;
  moveCount: number;
  gameStatus: GameStatus;
  aiDifficulty?: AI_Difficulty;
  turnTimeRemaining?: number;
}

export const freshGameState = (): GameState => ({
  board: Array(GAME_RULES.BOARD_SIZE).fill(null),
  currentPlayer: PlayerSymbol.X,
  winner: null,
  winningCombination: null,
  lastMoveIndex: null,
  players: {
    [PlayerSymbol.X]: {
      username: "",
      color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
      symbol: PlayerSymbol.X,
      type: PlayerTypes.HUMAN,
      isActive: false,
    },
    [PlayerSymbol.O]: {
      username: "",
      color: PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
      symbol: PlayerSymbol.O,
      type: PlayerTypes.HUMAN,
      isActive: false,
    },
  },
  moves: { [PlayerSymbol.X]: [], [PlayerSymbol.O]: [] },
  gameMode: GameModes.VS_COMPUTER,
  nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
  maxMoves: GAME_RULES.MAX_MOVES_PER_PLAYER,
  moveCount: 0,
  gameStatus: GameStatus.WAITING,
});

export interface InitialGameStateInput {
  gameMode: GameMode;
  playerXName: string;
  playerOName: string;
  playerColor: Color;
  opponentColor: Color;
  aiDifficulty?: AI_Difficulty;
}

export const createInitialGameState = (
  input: InitialGameStateInput,
): GameState => {
  const state = freshGameState();
  const humanSymbol = PlayerSymbol.X;
  const opponentSymbol = PlayerSymbol.O;
  return {
    ...state,
    gameStatus: GameStatus.ACTIVE,
    gameMode: input.gameMode,
    aiDifficulty: input.aiDifficulty,
    turnTimeRemaining: TURN_DURATION_MS,
    players: {
      [PlayerSymbol.X]: {
        ...state.players[PlayerSymbol.X],
        username: input.playerXName,
        color: input.playerColor,
        symbol: humanSymbol,
        type: PlayerTypes.HUMAN,
        isActive: true,
      },
      [PlayerSymbol.O]: {
        ...state.players[PlayerSymbol.O],
        username: input.playerOName,
        color: input.opponentColor,
        symbol: opponentSymbol,
        type:
          input.gameMode === GameModes.VS_COMPUTER
            ? PlayerTypes.COMPUTER
            : PlayerTypes.HUMAN,
        isActive: input.gameMode !== GameModes.ONLINE,
      },
    },
  };
};

export const getValidMoves = (board: Board): number[] => {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
};

export const isValidMove = (state: GameState, index: number, symbol: PlayerSymbol): boolean => {
  if (state.winner !== null) return false;
  if (state.currentPlayer !== symbol) return false;
  if (index < 0 || index >= GAME_RULES.BOARD_SIZE) return false;
  if (state.board[index] !== null) return false;
  return true;
};

export const canMakeMove = (
  gameMode: GameMode,
  currentPlayer: PlayerSymbol,
  playerSymbol: PlayerSymbol | null,
): boolean => {
  if (gameMode === GameModes.VS_COMPUTER) return playerSymbol === currentPlayer;
  // VS_FRIEND and ONLINE: the human can move whenever it's their turn.
  return playerSymbol === currentPlayer;
};

export const getNextPlayerSymbol = (current: PlayerSymbol): PlayerSymbol =>
  current === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;

export const isGameActive = (state: GameState): boolean =>
  state.gameStatus === GameStatus.ACTIVE && state.winner === null;

export const checkWinner = (board: Board): {
  winner: PlayerSymbol | null;
  combination: readonly [number, number, number] | null;
} => {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    const cell = board[a];
    if (cell && cell === board[b] && cell === board[c]) {
      return { winner: cell, combination: combo };
    }
  }
  return { winner: null, combination: null };
};

export const makeMove = (
  state: GameState,
  index: number,
): GameState | null => {
  if (!isValidMove(state, index, state.currentPlayer)) return null;
  const board = state.board.slice();
  const symbol = state.currentPlayer;
  const playerMoves = state.moves[symbol].slice();

  if (playerMoves.length >= state.maxMoves) {
    const oldestMove = playerMoves.shift();
    if (oldestMove !== undefined) board[oldestMove] = null;
  }

  board[index] = symbol;
  playerMoves.push(index);
  const moves = {
    ...state.moves,
    [symbol]: playerMoves,
  };
  const { winner, combination } = checkWinner(board);
  const updatedPlayers = {
    ...state.players,
    [symbol]: {
      ...state.players[symbol],
      lastMoveAt: Date.now(),
    },
  };
  return {
    ...state,
    board,
    moves,
    nextToRemove: {
      ...state.nextToRemove,
      [symbol]: winner === null && playerMoves.length === state.maxMoves
        ? playerMoves[0]
        : null,
    },
    players: updatedPlayers,
    winner,
    winningCombination: combination,
    currentPlayer: winner ? state.currentPlayer : getNextPlayerSymbol(symbol),
    lastMoveIndex: index,
    moveCount: state.moveCount + 1,
    gameStatus: winner ? GameStatus.COMPLETED : GameStatus.ACTIVE,
    turnTimeRemaining: TURN_DURATION_MS,
  };
};

export const findWinningMove = (
  board: Board,
  symbol: PlayerSymbol,
): number | null => {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    const cells = [board[a], board[b], board[c]];
    const mine = cells.filter((cell) => cell === symbol).length;
    const empty = cells.filter((cell) => cell === null).length;
    if (mine === 2 && empty === 1) {
      const emptyIndex = combo.find((i) => board[i] === null);
      if (emptyIndex !== undefined) return emptyIndex;
    }
  }
  return null;
};

export const getWinningMove = (board: Board, symbol: PlayerSymbol): number | null => {
  const win = findWinningMove(board, symbol);
  if (win !== null) return win;
  const opponent = symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  const block = findWinningMove(board, opponent);
  if (block !== null) return block;
  const center = 4;
  if (board[center] === null) return center;
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }
  return getValidMoves(board)[0] ?? null;
};

export const makeRandomMove = (board: Board): number | null => {
  const valid = getValidMoves(board);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
};

export const resolveOpponentColor = (
  gameMode: GameMode,
  playerColor: Color,
  opponentColor: Color,
): Color => {
  if (gameMode === GameModes.VS_FRIEND && opponentColor === playerColor) {
    const fallback = AVAILABLE_COLORS.find((c) => c !== playerColor);
    return fallback ?? opponentColor;
  }
  return opponentColor;
};

export const TURN_DURATION_MS_VALUE = TURN_DURATION_MS;
