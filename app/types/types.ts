import {
  AI_Difficulty,
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
  aiDifficulty?: AI_Difficulty;
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

// ONLINE
export interface ServerToClientEvents {
  playerAssigned: (payload: {
    symbol: PlayerSymbol;
    roomId: string;
    assignedColor: Color;
  }) => void; // Added assignedColor
  playerJoined: (payload: { username: string; symbol: PlayerSymbol }) => void;
  playerLeft: (payload: { symbol: PlayerSymbol | null }) => void; // Send symbol of leaving player
  gameStart: (gameState: GameState) => void; // Send initial state when game starts
  rematchRequested: (payload: { requesterSymbol: PlayerSymbol }) => void;
  colorChanged: (payload: { newColor: Color; reason: string }) => void;
  gameUpdate: (gameState: GameState) => void; // Send updated state after move/event
  gameReset: (gameState: GameState) => void; // Send state after reset
  error: (message: string) => void; // Send error messages
}

export interface ClientToServerEvents {
  login: (username: string, color: Color) => void;
  move: (index: number) => void;
  reset: () => void;
  requestRematch: () => void;
  acceptRematch: () => void;
  declineRematch: () => void;
  leaveRoom: () => void;
  disconnect: () => void; // Built-in event, but useful for typing
}

export interface GameRoom {
  id: string;
  // Store socket IDs of players currently in the room
  playerSocketIds: Set<string>;
  // Game state specific to this room
  state: GameState;
  rematchState: "none" | "requested"; // Track rematch status
  rematchRequesterSymbol: PlayerSymbol | null; // Who requested?
}

export interface SocketData {
  roomId?: string;
  symbol?: PlayerSymbol;
  username?: string;
}
