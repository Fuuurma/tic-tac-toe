import {
  BorderColor,
  Color,
  GAME_RULES,
  GameModes,
  PlayerSymbol,
  PlayerTypes,
} from "../game/constants/constants";

export type CellValue = PlayerSymbol | null;
export type GameBoard = CellValue[];
export type PlayerType = (typeof PlayerTypes)[keyof typeof PlayerTypes];
export type GameMode = (typeof GameModes)[keyof typeof GameModes];

export type PLAYER_CONFIG = {
  username: string;
  color: string;
  borderColor: string;
  label: string;
};

export interface GameState {
  board: GameBoard;
  currentPlayer: PlayerSymbol;
  winner: PlayerSymbol | "draw" | null;
  players: {
    [PlayerSymbol.X]: {
      id: string | null;
      type: PlayerType;
      color: Color;
      borderColor: BorderColor;
    };
    [PlayerSymbol.O]: {
      id: string | null;
      type: PlayerType;
      color: Color;
      borderColor: BorderColor;
    };
  };
  moves: {
    [PlayerSymbol.X]: number[];
    [PlayerSymbol.O]: number[];
  };
  gameMode: GameMode;
  nextToRemove: {
    [PlayerSymbol.X]: number | null;
    [PlayerSymbol.O]: number | null;
  };
  maxMoves: typeof GAME_RULES.MAX_MOVES_PER_PLAYER;
}

export const initialGameState: GameState = {
  board: Array(9).fill(null),
  currentPlayer: "X",
  winner: null,
  players: {
    X: null,
    O: null,
  },
  moves: {
    X: [],
    O: [],
  },
  gameMode: "human",

  nextToRemove: { X: null, O: null },
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
