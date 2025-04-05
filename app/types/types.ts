import {
  Color,
  GAME_RULES,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../game/constants/constants";

export type CellValue = PlayerSymbol | null;
export type GameBoard = CellValue[];
export type PlayerType = (typeof PlayerTypes)[keyof typeof PlayerTypes];
export type GameMode = (typeof GameModes)[keyof typeof GameModes];

export type BoardPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type WinningLine = [BoardPosition, BoardPosition, BoardPosition];
export type MovesHistory = number[];

export interface PlayerConfig {
  username: string;
  color: Color;
  symbol: PlayerSymbol;
  type: PlayerTypes;
  isActive: boolean;
  lastMoveAt?: Date;
}

export interface GameState {
  board: GameBoard;
  currentPlayer: PlayerSymbol;
  winner: PlayerSymbol | "draw" | null;
  players: Record<PlayerSymbol, PlayerConfig>;
  moves: {
    [PlayerSymbol.X]: MovesHistory;
    [PlayerSymbol.O]: MovesHistory;
  };
  gameMode: GameMode;
  nextToRemove: {
    [PlayerSymbol.X]: number | null;
    [PlayerSymbol.O]: number | null;
  };
  maxMoves: typeof GAME_RULES.MAX_MOVES_PER_PLAYER;

  turnTimeRemaining?: number;
  gameStatus: GameStatus;
}

export const initialGameState: GameState = {
  board: Array(GAME_RULES.BOARD_SIZE).fill(null),
  currentPlayer: PlayerSymbol.X,
  winner: null,
  players: {
    [PlayerSymbol.X]: {
      username: "",
      color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
      symbol: PlayerSymbol.X,
      type: PlayerTypes.HUMAN,
      isActive: true,
    },
    [PlayerSymbol.O]: {
      username: "",
      color: PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
      symbol: PlayerSymbol.O,
      type: PlayerTypes.HUMAN,
      isActive: false,
    },
  },
  moves: {
    [PlayerSymbol.X]: [],
    [PlayerSymbol.O]: [],
  },
  gameMode: GameModes.VS_COMPUTER,
  nextToRemove: {
    [PlayerSymbol.X]: null,
    [PlayerSymbol.O]: null,
  },
  maxMoves: GAME_RULES.MAX_MOVES_PER_PLAYER,
  gameStatus: GameStatus.WAITING,
};

export interface ServerToClientEvents {
  updateGame: (gameState: GameState) => void;
  playerJoined: (playerInfo: { username: string; type: PlayerType }) => void;
  gameReset: () => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  login: (username: string, gameMode: GameMode) => void;
  move: (index: number) => void;
  resetGame: () => void;
}
