import { AI_Difficulty, PlayerSymbol } from "./constants";
import { checkWinner, getValidMoves, makeMove, type GameState } from "./logic";

const WIN_SCORE = 1000;
const MINIMAX_DEPTH_NORMAL = 4;
const MINIMAX_DEPTH_HARD = 8;

const scoreTerminal = (winner: PlayerSymbol | null, player: PlayerSymbol): number => {
  if (winner === player) return WIN_SCORE;
  if (winner === null) return 0;
  return -WIN_SCORE;
};

const evaluate = (state: GameState, player: PlayerSymbol, depth: number): number => {
  const { winner } = checkWinner(state.board);
  if (winner !== null) return scoreTerminal(winner, player) - depth;
  // No winner and board full → draw (0). Board not full → neutral (0).
  // The 3-piece variant rarely fills the board, but the check is still correct.
  return 0;
};

const minimax = (
  state: GameState,
  player: PlayerSymbol,
  alpha: number,
  beta: number,
  depth: number,
): number => {
  if (depth === 0) return evaluate(state, player, depth);
  const { winner } = checkWinner(state.board);
  if (winner !== null) return evaluate(state, player, depth);
  if (state.board.every((c) => c !== null)) return 0;
  const isMaximizing = state.currentPlayer === player;
  const moves = getValidMoves(state.board);
  let a = alpha;
  let b = beta;
  if (isMaximizing) {
    let best = -Infinity;
    for (const index of moves) {
      const next = makeMove(state, index);
      if (!next) continue;
      const value = minimax(next, player, a, b, depth - 1);
      if (value > best) best = value;
      if (best > a) a = best;
      if (a >= b) break;
    }
    return best;
  }
  let best = Infinity;
  for (const index of moves) {
    const next = makeMove(state, index);
    if (!next) continue;
    const value = minimax(next, player, a, b, depth - 1);
    if (value < best) best = value;
    if (best < b) b = best;
    if (a >= b) break;
  }
  return best;
};

const pickBest = (state: GameState, player: PlayerSymbol, depth: number): number | null => {
  const moves = getValidMoves(state.board);
  if (moves.length === 0) return null;
  const isMaximizing = state.currentPlayer === player;
  let bestIndex = moves[0];
  let bestScore = isMaximizing ? -Infinity : Infinity;
  for (const index of moves) {
    const next = makeMove(state, index);
    if (!next) continue;
    const score = minimax(next, player, -Infinity, Infinity, depth - 1);
    if (isMaximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
};

const easyMove = (state: GameState): number | null => {
  const moves = getValidMoves(state.board);
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
};

export const getAIMove = (
  state: GameState,
  difficulty: AI_Difficulty,
  aiSymbol: PlayerSymbol,
): number | null => {
  // Hard guard: only run the AI on its own turn, and only while a game
  // is still in progress. Without this, the dispatcher happily returns
  // a legal move for the wrong player or while the board is full, which
  // a caller can mistake for an authoritative turn.
  if (
    state.gameStatus !== "ACTIVE" ||
    state.winner !== null ||
    state.currentPlayer !== aiSymbol
  ) {
    return null;
  }
  switch (difficulty) {
    case AI_Difficulty.EASY:
      return easyMove(state);
    case AI_Difficulty.NORMAL:
      return pickBest(state, aiSymbol, MINIMAX_DEPTH_NORMAL);
    case AI_Difficulty.HARD:
      return pickBest(state, aiSymbol, MINIMAX_DEPTH_HARD);
    default:
      return easyMove(state);
  }
};

export const canAIMove = (
  state: GameState,
  playerSymbol: PlayerSymbol | null,
): boolean => {
  // Same guard as getAIMove: an AI move can only fire when the AI is
  // actually the player to move and the game is in progress.
  if (
    state.gameStatus !== "ACTIVE" ||
    state.winner !== null ||
    playerSymbol !== state.currentPlayer
  ) {
    return false;
  }
  return getValidMoves(state.board).length > 0;
};
