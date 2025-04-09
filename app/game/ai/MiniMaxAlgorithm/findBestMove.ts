/**
 * Finds the best move from the current state using the Minimax algorithm with Alpha-Beta Pruning.
 * @param currentState The current game state.
 * @param aiSymbol The symbol the AI is playing as.
 * @param maxDepth How many moves ahead to search (adjust for performance vs strength). Tic-Tac-Toe (even modified) might allow high depth.
 * @returns The index of the best move found.
 */
export function findBestMoveMinimax(
  currentState: GameState,
  aiSymbol: PlayerSymbol,
  maxDepth: number = 9 // Max possible moves is 9, should be sufficient to solve
): number {
  if (isTerminal(currentState)) {
    throw new Error("Cannot find move for terminal state.");
  }

  let bestMove = -1;
  let bestValue = -Infinity;
  const validMoves = getValidMoves(currentState);

  console.log("--- Minimax Analysis ---");
  for (const move of validMoves) {
    const childState = applyMove(currentState, move as BoardPosition);
    // Call minimax for the state *after* the AI's potential move.
    // The next turn is the opponent's (minimizing player).
    const moveValue = minimax(
      childState,
      0,
      -Infinity,
      Infinity,
      false,
      aiSymbol,
      maxDepth
    );
    console.log(`Move: ${move}, Score: ${moveValue}`);

    if (moveValue > bestValue) {
      bestValue = moveValue;
      bestMove = move;
    }
    // Optional: Add randomness for multiple best moves?
    // if (moveValue === bestValue) {
    //     if (Math.random() < 0.5) { // 50% chance to switch if score is equal
    //          bestMove = move;
    //     }
    // }
  }
  console.log(`Minimax chosen move: ${bestMove} with score: ${bestValue}`);
  console.log("-----------------------");

  // Fallback if no move evaluated (shouldn't happen if valid moves exist)
  if (bestMove === -1 && validMoves.length > 0) {
    console.warn("Minimax failed to find a best move, choosing first valid.");
    return validMoves[0];
  }

  return bestMove;
}
