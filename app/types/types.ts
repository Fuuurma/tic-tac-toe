export type CellValue = "X" | "O" | null;
export type GameBoard = CellValue[];
export type PlayerType = "X" | "O";

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
}

export interface ServerToClientEvents {
  updateGame: (gameState: GameState) => void;
  playerJoined: (playerInfo: { username: string; type: PlayerType }) => void;
  gameReset: () => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  login: (username: string) => void;
  move: (index: number) => void;
  resetGame: () => void;
}
