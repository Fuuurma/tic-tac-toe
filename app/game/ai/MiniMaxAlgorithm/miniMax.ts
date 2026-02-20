import { BoardPosition, GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";
import { evaluateState } from "./evaluateState";
import { isGameActive } from "../../logic/isGameActive";
import { getValidMoves } from "../../logic/getValidMoves";
import { makeMove } from "../../logic/makeMove";
import { evaluateActiveState } from "./evaluateActiveState";

// Recursive Minimax function with Alpha-Beta Pruning
export function minimax(
  state: GameState,
  depth: number, // Current depth
  alpha: number, // Best score for maximizer found so far along the path
  beta: number, // Best score for minimizer found so far along the path
  isMaximizingPlayer: boolean, // Is it AI's turn?
  aiSymbol: PlayerSymbol,
  maxDepth: number // Max search depth
): number {
  if (!isGameActive(state)) {
    return evaluateState(state, aiSymbol, depth);
  }

  if (depth >= maxDepth) {
    return evaluateActiveState(state, aiSymbol);
  }

  const humanSymbol =
    aiSymbol === PlayerSymbol.O ? PlayerSymbol.X : PlayerSymbol.O;
  const validMoves = getValidMoves(state);
  const currentPlayer = isMaximizingPlayer ? aiSymbol : humanSymbol;

  if (isMaximizingPlayer) {
    // AI's turn - try to maximize score
    let maxEval = -Infinity;

    for (const move of validMoves) {
      const newState = makeMove(structuredClone(state), move as BoardPosition);

      const evaluation = minimax(
        newState,
        depth + 1,
        alpha,
        beta,
        false,
        aiSymbol,
        maxDepth
      );

      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);

      // Alpha-beta pruning
      if (beta <= alpha) {
        break;
      }
    }

    return maxEval;
  } else {
    // Opponent's turn - try to minimize score
    let minEval = Infinity;

    for (const move of validMoves) {
      // Create a NEW state for each move
      const newState = makeMove(structuredClone(state), move as BoardPosition);

      const evaluation = minimax(
        newState,
        depth + 1,
        alpha,
        beta,
        true,
        aiSymbol,
        maxDepth
      );

      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);

      // Alpha-beta pruning
      if (beta <= alpha) {
        break;
      }
    }

    return minEval;
  }
}
