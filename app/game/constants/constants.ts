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

export enum PlayerTypes {
  HUMAN = "HUMAN",
  COMPUTER = "COMPUTER",
}

export enum GameModes {
  VS_COMPUTER = "VS_COMPUTER",
  ONLINE = "ONLINE",
  VS_FRIEND = "VS_FRIEND",
}

export enum GameStatus {
  WAITING = "Waiting",
  ACTIVE = "active",
  COMPLETED = "completed",
}

export const GAME_MODES = {
  [GameModes.VS_COMPUTER]: {
    id: GameModes.VS_COMPUTER,
    label: "VS Computer",
    description: "Play against AI opponent",
    minPlayers: 1,
    maxTimePerMove: 10000,
  },
  [GameModes.ONLINE]: {
    id: GameModes.ONLINE,
    label: "Online Multiplayer",
    description: "Play against others online",
    minPlayers: 2,
    maxTimePerMove: 10000,
  },
  [GameModes.VS_FRIEND]: {
    id: GameModes.VS_FRIEND,
    label: "Local Multiplayer",
    description: "Play with a friend locally",
    minPlayers: 2,
    maxTimePerMove: 10000,
  },
} as const;

// WILL BE USED TO MATCH WITH THE GLOBALS.CSS VARIABLES
export enum Color {
  BLUE = "blue",
  GREEN = "green",
  YELLOW = "yellow",
  ORANGE = "orange",
  RED = "red",
  PINK = "pink",
  PURPLE = "purple",
  GRAY = "gray",
}

// Match with Tailwind classes in globals.css
export const COLOR_VARIANTS = {
  [Color.BLUE]: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-800",
    border: "border-blue-400 dark:border-blue-600",
    bgLight: "bg-blue-50 dark:bg-blue-900",
    pulse: "animate-pulse-blue",
    hover: "hover:bg-blue-200 dark:hover:bg-blue-700",
  },
  [Color.RED]: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-800",
    border: "border-red-400 dark:border-red-600",
    bgLight: "bg-red-50 dark:bg-red-900",
    pulse: "animate-pulse-red",
    hover: "hover:bg-red-200 dark:hover:bg-red-700",
  },
  [Color.GREEN]: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-800",
    border: "border-green-400 dark:border-green-600",
    bgLight: "bg-green-50 dark:bg-green-900",
    pulse: "animate-pulse-green",
    hover: "hover:bg-green-200 dark:hover:bg-green-700",
  },
  [Color.YELLOW]: {
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-800",
    border: "border-yellow-400 dark:border-yellow-600",
    bgLight: "bg-yellow-50 dark:bg-yellow-900",
    pulse: "animate-pulse-yellow",
    hover: "hover:bg-yellow-200 dark:hover:bg-yellow-700",
  },
  [Color.ORANGE]: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-100 dark:bg-orange-800",
    border: "border-orange-400 dark:border-orange-600",
    bgLight: "bg-orange-50 dark:bg-orange-900",
    pulse: "animate-pulse-orange",
    hover: "hover:bg-orange-200 dark:hover:bg-orange-700",
  },
  [Color.PINK]: {
    text: "text-pink-600 dark:text-pink-400",
    bg: "bg-pink-100 dark:bg-pink-800",
    border: "border-pink-400 dark:border-pink-600",
    bgLight: "bg-pink-50 dark:bg-pink-900",
    pulse: "animate-pulse-pink",
    hover: "hover:bg-pink-200 dark:hover:bg-pink-700",
  },
  [Color.PURPLE]: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-100 dark:bg-purple-800",
    border: "border-purple-400 dark:border-purple-600",
    bgLight: "bg-purple-50 dark:bg-purple-900",
    pulse: "animate-pulse-purple",
    hover: "hover:bg-purple-200 dark:hover:bg-purple-700",
  },
  [Color.GRAY]: {
    text: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-400 dark:border-gray-600",
    bgLight: "bg-gray-50 dark:bg-gray-900",
    pulse: "animate-pulse-gray",
    hover: "hover:bg-gray-200 dark:hover:bg-gray-700",
  },
} as const;

export type ColorVariant = keyof typeof COLOR_VARIANTS;

export enum PlayerSymbol {
  X = "X",
  O = "O",
}

export const PLAYER_CONFIG = {
  [PlayerSymbol.X]: {
    defaultColor: Color.BLUE,
    label: "Player X",
  },
  [PlayerSymbol.O]: {
    defaultColor: Color.RED,
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
