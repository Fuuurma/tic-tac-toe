import { GameState } from "@/app/types/types";
import { MonteCarloTreeSearchNode } from "./monteCarloTreeSearch";

/**
 * Finds the best move from the current state using MCTS.
 * @param currentState The current game state.
 * @param iterations The number of MCTS iterations to perform.
 * @param explorationParameter The exploration constant C for UCB1.
 * @returns The index of the best move found.
 */

export function findBestMoveMCTS(
  currentState: GameState,
  iterations: number,
  explorationParameter: number = Math.SQRT2
): number {
  if (isTerminal(currentState)) {
    throw new Error("Cannot find move for terminal state.");
  }

  const rootNode = new MonteCarloTreeSearchNode(currentState);
  const rootPlayer = rootNode.playerTurn;

  for (let i = 0; i < iterations; i++) {
    // 1. Selection
    let node: MonteCarloTreeSearchNode = rootNode;
    while (!node.isTerminalNode && node.isFullyExpanded) {
      const bestChild = node.selectBestChild(explorationParameter);
      if (!bestChild) break; // Should not happen unless terminal
      node = bestChild;
    }
  }

  return 0;
}
