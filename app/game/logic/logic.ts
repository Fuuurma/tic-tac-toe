import { GameBoard, GameState, PlayerType } from "@/app/types/types";

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
};

// Check for a winner
export const checkWinner = (board: GameBoard): PlayerType | "draw" | null => {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Columns
    [0, 4, 8],
    [2, 4, 6], // Diagonals
  ];

  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as PlayerType;
    }
  }

  // Check for draw
  if (board.every((cell) => cell !== null)) {
    return "draw";
  }

  return null;
};

// Make a move and handle the 3-active-pieces rule
export const makeMove = (gameState: GameState, index: number): GameState => {
  if (gameState.board[index] !== null || gameState.winner) {
    return gameState;
  }

  const newGameState = { ...gameState };
  const player = newGameState.currentPlayer;
  const playerMoves = [...newGameState.moves[player]];

  // Check if player already has 3 pieces on board
  if (playerMoves.length >= 3) {
    // Remove the oldest piece
    const oldestMoveIndex = playerMoves.shift() as number;
    newGameState.board[oldestMoveIndex] = null;
  }

  // Add new move
  playerMoves.push(index);
  newGameState.moves[player] = playerMoves;
  newGameState.board[index] = player;

  // Check for winner
  newGameState.winner = checkWinner(newGameState.board);

  // Switch player if no winner
  if (!newGameState.winner) {
    newGameState.currentPlayer = player === "X" ? "O" : "X";
  }

  return newGameState;
};
