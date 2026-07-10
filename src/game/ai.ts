import { AI_Difficulty, PlayerSymbol } from "./constants";
import { checkWinner, getValidMoves, makeMove, type GameState } from "./logic";

const WIN_SCORE = 1000;

const scoreTerminal = (winner: PlayerSymbol | null, player: PlayerSymbol): number => {
  if (winner === player) return WIN_SCORE;
  if (winner === null) return 0;
  return -WIN_SCORE;
};

const evaluate = (state: GameState, player: PlayerSymbol, depth: number): number => {
  const { winner } = checkWinner(state.board);
  if (winner !== null) return scoreTerminal(winner, player) - depth;
  if (state.board.every((c) => c !== null)) return 0;
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

type MctsNode = {
  state: GameState;
  parent: MctsNode | null;
  children: Map<number, MctsNode>;
  untriedMoves: number[];
  wins: number;
  visits: number;
  playerToMove: PlayerSymbol;
};

const createMctsNode = (state: GameState, parent: MctsNode | null): MctsNode => ({
  state,
  parent,
  children: new Map(),
  untriedMoves: getValidMoves(state.board),
  wins: 0,
  visits: 0,
  playerToMove: state.currentPlayer,
});

const ucb1 = (node: MctsNode, child: MctsNode, exploration = Math.SQRT2): number => {
  if (child.visits === 0) return Infinity;
  const winRate = child.wins / child.visits;
  return winRate + exploration * Math.sqrt(Math.log(node.visits) / child.visits);
};

const mctsSelect = (node: MctsNode): MctsNode => {
  if (node.untriedMoves.length === 0 && node.children.size > 0) {
    let bestChild: MctsNode | null = null;
    let bestScore = -Infinity;
    for (const child of node.children.values()) {
      const score = ucb1(node, child);
      if (score > bestScore) {
        bestScore = score;
        bestChild = child;
      }
    }
    return bestChild ? mctsSelect(bestChild) : node;
  }
  return node;
};

const mctsExpand = (node: MctsNode): MctsNode => {
  if (node.untriedMoves.length === 0) return node;
  const { winner } = checkWinner(node.state.board);
  if (winner !== null || node.state.board.every((c) => c !== null)) return node;
  const move = node.untriedMoves.splice(
    Math.floor(Math.random() * node.untriedMoves.length),
    1,
  )[0];
  const nextState = makeMove(node.state, move);
  if (!nextState) return node;
  const child = createMctsNode(nextState, node);
  node.children.set(move, child);
  return child;
};

const mctsSimulate = (state: GameState): PlayerSymbol | null => {
  let current = state;
  // The three-piece variant can cycle forever, so simulations need a draw cap.
  for (let ply = 0; ply < 100; ply += 1) {
    const { winner } = checkWinner(current.board);
    if (winner !== null) return winner;
    const moves = getValidMoves(current.board);
    if (moves.length === 0) return null;
    const next = makeMove(current, moves[Math.floor(Math.random() * moves.length)]);
    if (!next) return null;
    current = next;
  }
  return null;
};

const mctsBackpropagate = (node: MctsNode, winner: PlayerSymbol | null, aiSymbol: PlayerSymbol): void => {
  let current: MctsNode | null = node;
  while (current) {
    current.visits += 1;
    if (winner === aiSymbol) {
      current.wins += 1;
    } else if (winner !== null && winner !== aiSymbol) {
      current.wins -= 1;
    }
    current = current.parent;
  }
};

const mctsBestMove = (state: GameState, aiSymbol: PlayerSymbol, simulations: number): number | null => {
  const moves = getValidMoves(state.board);
  if (moves.length === 0) return null;
  const root = createMctsNode(state, null);
  for (let i = 0; i < simulations; i += 1) {
    let node: MctsNode = root;
    node = mctsSelect(node);
    if (node.untriedMoves.length > 0) {
      node = mctsExpand(node);
    }
    const winner = mctsSimulate(node.state);
    mctsBackpropagate(node, winner, aiSymbol);
  }
  let bestMove: number | null = null;
  let bestVisits = -1;
  for (const [move, child] of root.children) {
    if (child.visits > bestVisits) {
      bestVisits = child.visits;
      bestMove = move;
    }
  }
  return bestMove;
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
  switch (difficulty) {
    case AI_Difficulty.EASY:
      return easyMove(state);
    case AI_Difficulty.NORMAL:
      return pickBest(state, aiSymbol, 4);
    case AI_Difficulty.HARD:
      return pickBest(state, aiSymbol, 8);
    case AI_Difficulty.INSANE:
      return mctsBestMove(state, aiSymbol, 600);
    default:
      return easyMove(state);
  }
};

export const canAIMove = (
  state: GameState,
  playerSymbol: PlayerSymbol | null,
): boolean => {
  if (playerSymbol !== state.currentPlayer) return false;
  return getValidMoves(state.board).length > 0;
};
