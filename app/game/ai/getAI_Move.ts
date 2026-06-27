import { GameState } from "@/app/types/types";
import { isGameActive } from "../logic/isGameActive";
import {
  AI_Difficulty,
  MCTS_ITERATIONS,
  PlayerTypes,
} from "../constants/constants";
import { findBestMoveMCTS } from "./MonteCarloTS/findBestMove";
import { findBestMoveMinimax } from "./MiniMaxAlgorithm/findBestMove";
import { findBestMoveEasyAI } from "./simpleAI/findBestMove";

/**
 * Gets the AI's next move based on the difficulty level.
 */
export function getAIMove(
  gameState: GameState,
  difficulty: AI_Difficulty
): number {
  if (!isGameActive(gameState)) {
    console.error("AI requested move for terminal state.");
    return -1;
  }

  const aiSymbol = gameState.currentPlayer;
  if (!aiSymbol || gameState.players[aiSymbol]?.type !== PlayerTypes.COMPUTER) {
    console.error("getAIMove called when it wasn't AI's turn.");
    return -1;
  }

  let bestMove = -1;

  try {
    switch (difficulty) {
      case AI_Difficulty.EASY:
        bestMove = findBestMoveEasyAI(gameState, aiSymbol);
        break;

      case AI_Difficulty.NORMAL:
      case AI_Difficulty.HARD:
        const iterations = MCTS_ITERATIONS[difficulty];
        // Pass both iterations and time limit to MCTS
        bestMove = findBestMoveMCTS(gameState, iterations);
        break;

      case AI_Difficulty.INSANE:
        bestMove = findBestMoveMinimax(gameState, aiSymbol, 9);
        break;

      default:
        console.warn(
          `Unknown AI difficulty: ${difficulty}. Falling back to EASY.`
        );
        bestMove = findBestMoveEasyAI(gameState, aiSymbol);
        break;
    }
  } catch (error) {
    console.error(`Error during AI calculation (${difficulty}):`, error);
    // Fallback to easy move on any error during calculation
    bestMove = findBestMoveEasyAI(gameState, aiSymbol);
  }

  return bestMove;
}
