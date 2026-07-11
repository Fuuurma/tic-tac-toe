export const PlayerSymbol = {
  X: "X",
  O: "O",
} as const;
export type PlayerSymbol = (typeof PlayerSymbol)[keyof typeof PlayerSymbol];

export const GameModes = {
  VS_COMPUTER: "VS_COMPUTER",
  VS_FRIEND: "VS_FRIEND",
  ONLINE: "ONLINE",
} as const;
export type GameMode = (typeof GameModes)[keyof typeof GameModes];

export const GameStatus = {
  WAITING: "WAITING",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export const PlayerTypes = {
  HUMAN: "HUMAN",
  COMPUTER: "COMPUTER",
} as const;
export type PlayerType = (typeof PlayerTypes)[keyof typeof PlayerTypes];

export const Color = {
  BLUE: "blue",
  GREEN: "green",
  YELLOW: "yellow",
  ORANGE: "orange",
  RED: "red",
  PINK: "pink",
  PURPLE: "purple",
  GRAY: "gray",
} as const;
export type Color = (typeof Color)[keyof typeof Color];
export const AVAILABLE_COLORS: Color[] = Object.values(Color);

export const AI_Difficulty = {
  EASY: "EASY",
  NORMAL: "NORMAL",
  HARD: "HARD",
  INSANE: "INSANE",
} as const;
export type AI_Difficulty = (typeof AI_Difficulty)[keyof typeof AI_Difficulty];

export const GAME_RULES = {
  BOARD_SIZE: 9,
  MAX_MOVES_PER_PLAYER: 3,
} as const;
export const TURN_DURATION_MS = 10_000;
export const AI_MOVE_DELAY_MS = 600;

export const PLAYER_CONFIG: Record<
  PlayerSymbol,
  { label: string; defaultColor: Color; accessibleName: string }
> = {
  [PlayerSymbol.X]: {
    label: "Player X",
    defaultColor: Color.BLUE,
    accessibleName: "X",
  },
  [PlayerSymbol.O]: {
    label: "Player O",
    defaultColor: Color.RED,
    accessibleName: "O",
  },
};

export const WINNING_COMBINATIONS: ReadonlyArray<
  readonly [0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8]
> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export const COLOR_RING_CLASSES: Record<Color, string> = {
  [Color.BLUE]: "ring-blue-500",
  [Color.GREEN]: "ring-green-500",
  [Color.YELLOW]: "ring-yellow-500",
  [Color.ORANGE]: "ring-orange-500",
  [Color.RED]: "ring-red-500",
  [Color.PINK]: "ring-pink-500",
  [Color.PURPLE]: "ring-purple-500",
  [Color.GRAY]: "ring-gray-500",
};

export const COLOR_BG_CLASSES: Record<Color, string> = {
  [Color.BLUE]: "bg-blue-500",
  [Color.GREEN]: "bg-green-500",
  [Color.YELLOW]: "bg-yellow-500",
  [Color.ORANGE]: "bg-orange-500",
  [Color.RED]: "bg-red-500",
  [Color.PINK]: "bg-pink-500",
  [Color.PURPLE]: "bg-purple-500",
  [Color.GRAY]: "bg-gray-500",
};
