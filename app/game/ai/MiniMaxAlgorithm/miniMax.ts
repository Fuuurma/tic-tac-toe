import { BoardPosition, GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";
import { evaluateState } from "./evaluateState";
import { isGameActive } from "../../logic/isGameActive";
import { getValidMoves } from "../../logic/getValidMoves";
import { makeMove } from "../../logic/makeMove";

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
  // Check for terminal state or max depth reached
  if (!isGameActive(state) || depth === maxDepth) {
    // Adjust score based on depth? Less important for win/loss/draw evaluation
    return evaluateState(state, aiSymbol);
  }

  const humanSymbol =
    aiSymbol === PlayerSymbol.O ? PlayerSymbol.X : PlayerSymbol.O;
  //getOpponent(aiSymbol);
  const validMoves = getValidMoves(state);
  const currentPlayer = isMaximizingPlayer ? aiSymbol : humanSymbol;

  if (isMaximizingPlayer) {
    // AI's turn (Maximize score)
    let maxEval = -Infinity;
    for (const move of validMoves) {
      const childState = makeMove(state, move as BoardPosition);
      const evaluation = minimax(
        childState,
        depth + 1,
        alpha,
        beta,
        false,
        aiSymbol,
        maxDepth
      );
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation); // Update alpha
      if (beta <= alpha) {
        break; // Beta cut-off
      }
    }
    return maxEval;
  } else {
    // Opponent's turn (Minimize score)
    let minEval = Infinity;
    for (const move of validMoves) {
      const childState = makeMove(state, move as BoardPosition);
      const evaluation = minimax(
        childState,
        depth + 1,
        alpha,
        beta,
        true,
        aiSymbol,
        maxDepth
      );
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation); // Update beta
      if (beta <= alpha) {
        break; // Alpha cut-off
      }
    }
    return minEval;
  }
}
