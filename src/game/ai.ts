import {
  AI_Difficulty,
  PlayerSymbol,
  WINNING_COMBINATIONS,
  oppositeSymbol,
} from "./constants";
import {
  checkWinner,
  getValidMoves,
  isGameActive,
  makeMove,
  type GameState,
} from "./logic";

const WIN_SCORE = 100_000;
const MINIMAX_DEPTH_NORMAL = 4;
const MINIMAX_DEPTH_HARD = 8;
const IMMEDIATE_THREAT_SCORE = 400;
const LINE_SCORES = [0, 12, 90] as const;
const POSITION_WEIGHTS = [3, 2, 3, 2, 6, 2, 3, 2, 3] as const;
const EASY_MOVE_WEIGHTS = [3, 2, 3, 2, 5, 2, 3, 2, 3] as const;

interface SearchOptions {
  depth: number;
  randomizeTies: boolean;
}

interface SearchContext {
  player: PlayerSymbol;
  path: Set<string>;
}

const stateKey = (state: GameState): string =>
  [
    state.currentPlayer,
    state.board.map((cell) => cell ?? "-").join(""),
    state.moves[PlayerSymbol.X].join(""),
    state.moves[PlayerSymbol.O].join(""),
    state.maxMoves,
  ].join("|");

const scoreTerminal = (
  winner: PlayerSymbol,
  player: PlayerSymbol,
  depthRemaining: number,
): number => {
  // More remaining depth means the terminal was reached sooner.
  if (winner === player) return WIN_SCORE + depthRemaining;
  return -WIN_SCORE - depthRemaining;
};

const countImmediateWins = (state: GameState, symbol: PlayerSymbol): number => {
  const stateForSymbol =
    state.currentPlayer === symbol ? state : { ...state, currentPlayer: symbol };
  let wins = 0;
  for (const index of getValidMoves(state.board)) {
    if (makeMove(stateForSymbol, index)?.winner === symbol) wins += 1;
  }
  return wins;
};

const getOldestMove = (
  state: GameState,
  symbol: PlayerSymbol,
): number | null =>
  state.moves[symbol].length === state.maxMoves
    ? (state.moves[symbol][0] ?? null)
    : null;

const scoreLines = (state: GameState, symbol: PlayerSymbol): number => {
  const opponent = oppositeSymbol(symbol);
  const oldestMove = getOldestMove(state, symbol);
  let score = 0;

  for (const combination of WINNING_COMBINATIONS) {
    let ownPieces = 0;
    let opponentPieces = 0;
    for (const index of combination) {
      if (state.board[index] === symbol) ownPieces += 1;
      else if (state.board[index] === opponent) opponentPieces += 1;
    }
    if (ownPieces === 0 || opponentPieces > 0) continue;

    const baseScore = LINE_SCORES[ownPieces] ?? 0;
    // A line depending on the oldest mark is less durable because that mark
    // disappears on this player's next placement.
    const evictionFactor =
      oldestMove !== null &&
      combination.some((index) => index === oldestMove)
        ? 0.35
        : 1;
    score += baseScore * evictionFactor;
  }

  return score;
};

const scorePositions = (state: GameState, symbol: PlayerSymbol): number => {
  const oldestMove = getOldestMove(state, symbol);
  let score = 0;
  for (let index = 0; index < state.board.length; index += 1) {
    if (state.board[index] !== symbol) continue;
    const evictionFactor = index === oldestMove ? 0.5 : 1;
    score += POSITION_WEIGHTS[index] * evictionFactor;
  }
  return score;
};

const evaluateNonTerminal = (state: GameState, player: PlayerSymbol): number => {
  const opponent = oppositeSymbol(player);
  const playerWins = countImmediateWins(state, player);
  const opponentWins = countImmediateWins(state, opponent);

  let score =
    scoreLines(state, player) -
    scoreLines(state, opponent) +
    scorePositions(state, player) -
    scorePositions(state, opponent) +
    (playerWins - opponentWins) * IMMEDIATE_THREAT_SCORE;

  // A threat is more valuable when its owner is actually about to move.
  if (state.currentPlayer === player) {
    score += playerWins * IMMEDIATE_THREAT_SCORE;
  } else {
    score -= opponentWins * IMMEDIATE_THREAT_SCORE;
  }
  return score;
};

const evaluate = (
  state: GameState,
  player: PlayerSymbol,
  depthRemaining: number,
): number => {
  const { winner } = checkWinner(state.board);
  if (winner !== null) return scoreTerminal(winner, player, depthRemaining);
  return evaluateNonTerminal(state, player);
};

const orderedChildren = (
  state: GameState,
  player: PlayerSymbol,
): Array<{ index: number; state: GameState }> => {
  const children: Array<{ index: number; state: GameState; score: number }> = [];
  for (const index of getValidMoves(state.board)) {
    const next = makeMove(state, index);
    if (!next) continue;
    children.push({
      index,
      state: next,
      score: evaluate(next, player, 0),
    });
  }
  const direction = state.currentPlayer === player ? -1 : 1;
  children.sort(
    (left, right) =>
      direction * (left.score - right.score) || left.index - right.index,
  );
  return children;
};

const minimax = (
  state: GameState,
  alpha: number,
  beta: number,
  depth: number,
  context: SearchContext,
): number => {
  const { winner } = checkWinner(state.board);
  if (winner !== null) return scoreTerminal(winner, context.player, depth);
  if (depth === 0) return evaluateNonTerminal(state, context.player);

  const positionKey = stateKey(state);
  if (context.path.has(positionKey)) return 0;
  let a = alpha;
  let b = beta;

  context.path.add(positionKey);
  const isMaximizing = state.currentPlayer === context.player;
  let best = isMaximizing ? -Infinity : Infinity;
  const children = orderedChildren(state, context.player);

  if (isMaximizing) {
    for (const child of children) {
      const value = minimax(child.state, a, b, depth - 1, context);
      if (value > best) best = value;
      if (best > a) a = best;
      if (a >= b) break;
    }
  } else {
    for (const child of children) {
      const value = minimax(child.state, a, b, depth - 1, context);
      if (value < best) best = value;
      if (best < b) b = best;
      if (a >= b) break;
    }
  }

  context.path.delete(positionKey);
  return best;
};

const pickBest = (
  state: GameState,
  player: PlayerSymbol,
  options: SearchOptions,
): number | null => {
  const children = orderedChildren(state, player);
  if (children.length === 0) return null;

  const rootKey = stateKey(state);
  const context: SearchContext = {
    player,
    path: new Set([rootKey]),
  };
  let bestScore = -Infinity;
  let bestMoves: number[] = [];
  for (const child of children) {
    const score = minimax(
      child.state,
      -Infinity,
      Infinity,
      options.depth - 1,
      context,
    );
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [child.index];
    } else if (score === bestScore) {
      bestMoves.push(child.index);
    }
  }

  if (!options.randomizeTies || bestMoves.length === 1) return bestMoves[0];
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
};

const easyMove = (state: GameState): number | null => {
  const moves = getValidMoves(state.board);
  if (moves.length === 0) return null;
  const totalWeight = moves.reduce(
    (total, index) => total + EASY_MOVE_WEIGHTS[index],
    0,
  );
  let selection = Math.random() * totalWeight;
  for (const index of moves) {
    selection -= EASY_MOVE_WEIGHTS[index];
    if (selection < 0) return index;
  }
  return moves[moves.length - 1];
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
    !isGameActive(state) ||
    state.currentPlayer !== aiSymbol
  ) {
    return null;
  }
  switch (difficulty) {
    case AI_Difficulty.EASY:
      return easyMove(state);
    case AI_Difficulty.NORMAL:
      return pickBest(state, aiSymbol, {
        depth: MINIMAX_DEPTH_NORMAL,
        randomizeTies: true,
      });
    case AI_Difficulty.HARD:
      return pickBest(state, aiSymbol, {
        depth: MINIMAX_DEPTH_HARD,
        randomizeTies: false,
      });
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
    !isGameActive(state) ||
    playerSymbol !== state.currentPlayer
  ) {
    return false;
  }
  return getValidMoves(state.board).length > 0;
};
