import { PALETTE, hexToRgb } from "./palette";

export const PlayerSymbol = {
  X: "X",
  O: "O",
} as const;
export type PlayerSymbol = (typeof PlayerSymbol)[keyof typeof PlayerSymbol];

export const SymbolShape = {
  X: "X",
  O: "O",
  TRIANGLE: "triangle",
  SQUARE: "square",
  DIAMOND: "diamond",
  STAR: "star",
  CRESCENT: "crescent",
  HEART: "heart",
} as const;
export type SymbolShape = (typeof SymbolShape)[keyof typeof SymbolShape];
export const AVAILABLE_SHAPES: SymbolShape[] = Object.values(SymbolShape);

/**
 * Shape ids that older builds saved or sent. The hexagon gave way to the
 * crescent; anything that reads a stored or relayed shape maps it through
 * here so an old preference or an old cached client keeps working.
 */
export const LEGACY_SHAPES: Readonly<Record<string, SymbolShape>> = {
  hexagon: SymbolShape.CRESCENT,
};

export const SHAPE_LABELS: Record<SymbolShape, string> = {
  [SymbolShape.X]: "X",
  [SymbolShape.O]: "O",
  [SymbolShape.TRIANGLE]: "Triangle",
  [SymbolShape.SQUARE]: "Square",
  [SymbolShape.DIAMOND]: "Diamond",
  [SymbolShape.STAR]: "Star",
  [SymbolShape.CRESCENT]: "Crescent",
  [SymbolShape.HEART]: "Heart",
};

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
// Canonical defaults (X blue, O red) lead; purple is an extended pick, not a
// default, so it sits last and never in the primary 4-up row beside blue/red.
export const AVAILABLE_COLORS: Color[] = [
  Color.BLUE,
  Color.RED,
  Color.GREEN,
  Color.YELLOW,
  Color.ORANGE,
  Color.PINK,
  Color.GRAY,
  Color.PURPLE,
];

export const AI_Difficulty = {
  EASY: "EASY",
  NORMAL: "NORMAL",
  HARD: "HARD",
} as const;
export type AI_Difficulty = (typeof AI_Difficulty)[keyof typeof AI_Difficulty];

export const AI_DIFFICULTY_LABELS: Record<AI_Difficulty, string> = {
  [AI_Difficulty.EASY]: "Easy",
  [AI_Difficulty.NORMAL]: "Normal",
  [AI_Difficulty.HARD]: "Hard",
};

export const GAME_RULES = {
  BOARD_SIZE: 9,
  MAX_MOVES_PER_PLAYER: 3,
} as const;
export const TURN_DURATION_MS = 10_000;
export const REMATCH_TIMEOUT_MS = 30_000;
// F712: bound on a guest's "Waiting for host…" wait. Must exceed the relay's
// 30s reconnect grace so a dropped-but-seated host resolves through the DO's
// own peer-left signal before this deadline fires for a never-seated one.
export const HOST_ABSENT_TIMEOUT_MS = 45_000;
export const AI_MOVE_DELAY_MS = 700;
export const AI_MOVE_DELAY_JITTER_MS = 600;
/** How long a "copied" confirmation stays on screen. Three copy affordances
 *  share it (room-code chip, invite link, share strip); it lived as a local
 *  const in one of them and as a bare `1800` in the other two. */
export const COPY_FLASH_MS = 1800;
export const GAME_ID = "tictactoe";

export const PLAYER_CONFIG: Record<
  PlayerSymbol,
  { label: string; defaultColor: Color; defaultShape: SymbolShape; accessibleName: string }
> = {
  [PlayerSymbol.X]: {
    label: "Player X",
    defaultColor: Color.BLUE,
    defaultShape: SymbolShape.X,
    accessibleName: "X",
  },
  [PlayerSymbol.O]: {
    label: "Player O",
    defaultColor: Color.RED,
    defaultShape: SymbolShape.O,
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

// Mark ink per chip background: white text fails contrast on the light
// 500-weights (yellow/green/orange) — those take near-black ink (F298).
export const COLOR_MARK_TEXT: Record<Color, string> = {
  [Color.BLUE]: "text-white",
  [Color.GREEN]: "text-neutral-950",
  [Color.YELLOW]: "text-neutral-950",
  [Color.ORANGE]: "text-neutral-950",
  [Color.RED]: "text-white",
  [Color.PINK]: "text-white",
  [Color.PURPLE]: "text-white",
  [Color.GRAY]: "text-white",
};

export const COLOR_RGB: Record<Color, string> = Object.fromEntries(
  Object.entries(PALETTE).map(([color, { chip }]) => [color, hexToRgb(chip).join(" ")]),
) as Record<Color, string>;

const OPPOSITE_COLOR: Record<Color, Color> = {
  [Color.BLUE]: Color.RED,
  [Color.RED]: Color.BLUE,
  [Color.GREEN]: Color.PURPLE,
  [Color.PURPLE]: Color.GREEN,
  // Yellow and orange are the two nearest hues in the set, so neither is the
  // other's opponent: each faces a colour nothing like it.
  [Color.YELLOW]: Color.PURPLE,
  [Color.ORANGE]: Color.BLUE,
  [Color.PINK]: Color.GRAY,
  [Color.GRAY]: Color.PINK,
};

export const oppositeColor = (color: Color): Color =>
  OPPOSITE_COLOR[color] ?? Color.GRAY;

export const oppositeSymbol = (symbol: PlayerSymbol): PlayerSymbol =>
  symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;

export const randomPlayerSymbol = (): PlayerSymbol =>
  Math.random() < 0.5 ? PlayerSymbol.X : PlayerSymbol.O;
