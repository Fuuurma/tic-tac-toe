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
  gameMode: "human",
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

// AI logic for computer opponent
export const computerMove = (gameState: GameState): GameState => {
  if (gameState.winner || gameState.currentPlayer !== "O") {
    return gameState;
  }

  // Create a copy of the game state
  const newGameState = { ...gameState };

  // Priority 1: Check if computer can win with next move
  const winningMove = findWinningMove(newGameState, "O");
  if (winningMove !== -1) {
    return makeMove(newGameState, winningMove);
  }

  // Priority 2: Block player from winning
  const blockingMove = findWinningMove(newGameState, "X");
  if (blockingMove !== -1) {
    return makeMove(newGameState, blockingMove);
  }

  // Priority 3: Take center if available
  if (newGameState.board[4] === null) {
    return makeMove(newGameState, 4);
  }

  // Priority 4: Take any available corner
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(
    (index) => newGameState.board[index] === null
  );
  if (availableCorners.length > 0) {
    const randomCorner =
      availableCorners[Math.floor(Math.random() * availableCorners.length)];
    return makeMove(newGameState, randomCorner);
  }

  // Priority 5: Take any available side
  const sides = [1, 3, 5, 7];
  const availableSides = sides.filter(
    (index) => newGameState.board[index] === null
  );
  if (availableSides.length > 0) {
    const randomSide =
      availableSides[Math.floor(Math.random() * availableSides.length)];
    return makeMove(newGameState, randomSide);
  }

  // Fallback: Choose first available move (should rarely happen)
  const availableMoves = newGameState.board
    .map((cell, index) => (cell === null ? index : -1))
    .filter((index) => index !== -1);

  if (availableMoves.length > 0) {
    return makeMove(newGameState, availableMoves[0]);
  }

  // No moves available - return unchanged state
  return newGameState;
};



/ Helper function to find a winning move for a player
const findWinningMove = (gameState: GameState, player: PlayerType): number => {
  const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];
  
  // Check each winning combination
  for (const combination of winningCombinations) {
    const [a, b, c] = combination;
    const values = [gameState.board[a], gameState.board[b], gameState.board[c]];
    
    // Check if we can win in this combination
    if (values.filter(v => v === player).length === 2 && values.includes(null)) {
      // Find the empty position
      if (gameState.board[a] === null) return a;
      if (gameState.board[b] === null) return b;
      if (gameState.board[c] === null) return c;
    }
  }
  
  return -1; // No winning move found
};
