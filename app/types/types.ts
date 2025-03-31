export type CellValue = "X" | "O" | null;
export type GameBoard = CellValue[];
export type PlayerType = "X" | "O";
export type GameMode = "human" | "computer";

export interface GameState {
  board: GameBoard;
  currentPlayer: PlayerType;
  winner: PlayerType | "draw" | null;
  players: {
    X: string | null;
    O: string | null;
  };
  moves: {
    X: number[];
    O: number[];
  };
  gameMode: GameMode;
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
