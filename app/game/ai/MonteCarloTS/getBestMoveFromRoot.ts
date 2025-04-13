import { getValidMoves } from "../../logic/getValidMoves";
import { MonteCarloTreeSearchNode } from "./monteCarloTreeSearch";

// Select the best move from the root node's children after all iterations
export function selectBestMoveFromRoot(
  rootNode: MonteCarloTreeSearchNode
): number {
  if (rootNode.children.size === 0) {
    console.warn("MCTS root has no children after iterations!");
    const validMoves = getValidMoves(rootNode.state);
    return validMoves.length > 0 ? validMoves[0] : -1;
  }

  let bestMove = -1;
  let bestScore = -Infinity;
  let bestVisits = -1;
  let bestRobustScore = -Infinity;

  console.log("--- MCTS Results After Simulation ---");
  for (const [move, child] of rootNode.children.entries()) {
    if (child.visits > 0) {
      const winRate = child.score / child.visits;
      const robustScore = winRate + 1.0 / Math.sqrt(child.visits);

      console.log(
        `Move: ${move}, Score: ${child.score.toFixed(1)}, ` +
          `Visits: ${child.visits}, Win Rate: ${winRate.toFixed(3)}, ` +
          `Robust Score: ${robustScore.toFixed(3)}`
      );

      // We can choose based on various strategies:

      // 1. Highest win rate (exploitation)
      if (winRate > bestScore) {
        bestScore = winRate;
        bestMove = move;
      }

      // 2. Most visited (robust choice)
      if (child.visits > bestVisits) {
        bestVisits = child.visits;
      }

      // 3. Robust score (combines win rate with visit count)
      if (robustScore > bestRobustScore) {
        bestRobustScore = robustScore;
      }
    } else {
      console.log(`Move: ${move}, Score: 0, Visits: 0`);
    }
  }

  // For medium difficulty, we might use a mix of strategies or add randomness

  // For this implementation, we'll use the win rate with a probability proportional
  // to the difficulty level. For medium/hard difficulties, we'll use it most of the time.
  const useOptimalStrategy = Math.random() < 0.8; // 80% chance of using optimal strategy

  // Let's pick the most robust move (determined by the robust score)
  let selectedMove = bestMove;

  if (!useOptimalStrategy) {
    // For some randomness (easy/medium difficulty), occasionally pick something else
    console.log("Using suboptimal strategy for variety");
    const validMoves = getValidMoves(rootNode.state);
    const randomMove =
      validMoves[Math.floor(Math.random() * validMoves.length)];

    // Ensure the random move isn't terrible - should at least have been visited
    const randomChild = rootNode.children.get(randomMove);
    if (randomChild && randomChild.visits > 0) {
      selectedMove = randomMove;
    }
  }

  console.log(`Selected move: ${selectedMove}`);
  console.log("--------------------");

  return selectedMove;
}
