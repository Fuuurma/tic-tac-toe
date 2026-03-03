import { PlayerSymbol, GameStatus, GAME_RULES, Color, PlayerTypes, GameModes } from "@/app/game/constants/constants";
import { GameState } from "@/app/types/types";

export const PlayerSymbols = PlayerSymbol;
export const GameStatuses = GameStatus;

export function createMockGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    board: Array(GAME_RULES.BOARD_SIZE).fill(null),
    currentPlayer: PlayerSymbol.X,
    winner: null,
    winningCombination: null,
    lastMoveIndex: null,
    players: {
      [PlayerSymbol.X]: {
        username: "Player1",
        color: Color.BLUE,
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: true,
      },
      [PlayerSymbol.O]: {
        username: "Player2",
        color: Color.RED,
        symbol: PlayerSymbol.O,
        type: PlayerTypes.HUMAN,
        isActive: true,
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
    gameStatus: GameStatus.ACTIVE,
    ...overrides,
  };
}

export function createBoardWithMoves(
  xMoves: number[] = [],
  oMoves: number[] = []
): (PlayerSymbol | null)[] {
  const board: (PlayerSymbol | null)[] = Array(GAME_RULES.BOARD_SIZE).fill(null);
  xMoves.forEach((index) => {
    board[index] = PlayerSymbol.X;
  });
  oMoves.forEach((index) => {
    board[index] = PlayerSymbol.O;
  });
  return board;
}

export function createWinningBoard(
  winner: PlayerSymbol,
  winningCombination: [number, number, number]
): (PlayerSymbol | null)[] {
  const board: (PlayerSymbol | null)[] = Array(GAME_RULES.BOARD_SIZE).fill(null);
  const opponent = winner === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  
  board[winningCombination[0]] = winner;
  board[winningCombination[1]] = winner;
  board[winningCombination[2]] = winner;

  const opponentPositions = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(
    (i) => !winningCombination.includes(i)
  ).slice(0, 3);

  opponentPositions.forEach((i) => {
    board[i] = opponent;
  });

  return board;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const WINNING_COMBINATIONS: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
