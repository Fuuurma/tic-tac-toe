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
import { match } from "ts-pattern";

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

  try {
    return match(difficulty)
      .with(AI_Difficulty.EASY, () => findBestMoveEasyAI(gameState, aiSymbol))
      .with(AI_Difficulty.NORMAL, AI_Difficulty.HARD, value => (
        findBestMoveMCTS(gameState, MCTS_ITERATIONS[value])
      ))
      .with(AI_Difficulty.INSANE, () => findBestMoveMinimax(gameState, aiSymbol, 9))
      .exhaustive();
  } catch (error) {
    console.error(`Error during AI calculation (${difficulty}):`, error);
    return findBestMoveEasyAI(gameState, aiSymbol);
  }
}
