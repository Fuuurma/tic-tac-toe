// types/constants.ts
export const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8], // Rows
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8], // Columns
  [0, 4, 8],
  [2, 4, 6], // Diagonals
] as const;

export type WinningCombination = (typeof WINNING_COMBINATIONS)[number];

export enum PlayerType {
  HUMAN = "HUMAN",
  COMPUTER = "COMPUTER",
}

export enum GameMode {
  VS_COMPUTER = "VS_COMPUTER",
  ONLINE = "ONLINE",
  VS_FRIEND = "VS_FRIEND",
}

export const GAME_MODES = {
  [GameMode.VS_COMPUTER]: {
    id: GameMode.VS_COMPUTER,
    label: "VS Computer",
    description: "Play against AI opponent",
    minPlayers: 1,
  },
  [GameMode.ONLINE]: {
    id: GameMode.ONLINE,
    label: "Online Multiplayer",
    description: "Play against others online",
    minPlayers: 2,
  },
  [GameMode.VS_FRIEND]: {
    id: GameMode.VS_FRIEND,
    label: "Local Multiplayer",
    description: "Play with a friend locally",
    minPlayers: 2,
  },
} as const;

export enum Color {
  PRIMARY = "#2563eb",
  SECONDARY = "#4f46e5",
  ACCENT = "#f59e0b",
  SUCCESS = "#22c55e",
  ERROR = "#ef4444",
  WARNING = "#eab308",
  NEUTRAL = "#64748b",
}

export enum PlayerSymbol {
  X = "X",
  O = "O",
}

export const PLAYER_CONFIG = {
  [PlayerSymbol.X]: {
    color: Color.PRIMARY,
    label: "Player X",
  },
  [PlayerSymbol.O]: {
    color: Color.SECONDARY,
    label: "Player O",
  },
} as const;

export const GAME_RULES = {
  MAX_MOVES_PER_PLAYER: 3,
  BOARD_SIZE: 9,
  TIMEOUT_DURATION: 5000,
} as const;

export const ERROR_MESSAGES = {
  INVALID_MOVE: "Invalid move!",
  GAME_FULL: "Game is full!",
  PLAYER_EXISTS: "Player already exists!",
  UNAUTHORIZED: "Unauthorized action!",
} as const;

export const SESSION_CONFIG = {
  INACTIVITY_TIMEOUT: 15 * 60 * 1000, // 15 minutes
  MAX_GAMES_PER_USER: 5,
} as const;
