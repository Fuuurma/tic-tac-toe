import { GameState } from "@/app/types/types";
import { isGameActive } from "../logic/isGameActive";
import { AI_Difficulty, PlayerTypes } from "../constants/constants";

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

  const startTime = performance.now();
  let bestMove = -1;

  try {
    switch (difficulty) {
      case AIDifficulty.EASY:
        console.log("AI Difficulty: EASY (Rule-Based)");
        bestMove = findBestMoveEasy(gameState, aiSymbol);
        break;

      case AIDifficulty.NORMAL:
      case AIDifficulty.HARD:
        console.log(`AI Difficulty: ${difficulty.toUpperCase()} (MCTS)`);
        const iterations = MCTS_ITERATIONS[difficulty];
        const timeLimit = MCTS_TIME_LIMIT[difficulty];
        // Pass both iterations and time limit to MCTS
        bestMove = findBestMoveMCTS(gameState, iterations, timeLimit);
        break;

      case AIDifficulty.INSANE:
        console.log("AI Difficulty: INSANE (Minimax)");
        // Depth can be adjusted. For modified TicTacToe, 9 might be safe,
        // but test performance.
        bestMove = findBestMoveMinimax(gameState, aiSymbol, 9);
        break;

      default:
        console.warn(
          `Unknown AI difficulty: ${difficulty}. Falling back to EASY.`
        );
        bestMove = findBestMoveEasy(gameState, aiSymbol);
        break;
    }
  } catch (error) {
    console.error(`Error during AI calculation (${difficulty}):`, error);
    // Fallback to easy move on any error during calculation
    console.log("Falling back to EASY due to error.");
    bestMove = findBestMoveEasy(gameState, aiSymbol);
  }

  const endTime = performance.now();
  console.log(
    `AI (${difficulty}) chose move ${bestMove} in ${(
      endTime - startTime
    ).toFixed(2)} ms`
  );

  // Final safety check
  if (!getValidMoves(gameState).includes(bestMove)) {
    console.error(
      `AI (${difficulty}) chose an invalid move: ${bestMove}. Falling back.`
    );
    const validMoves = getValidMoves(gameState);
    return validMoves.length > 0 ? validMoves[0] : -1;
  }

  return bestMove;
}
