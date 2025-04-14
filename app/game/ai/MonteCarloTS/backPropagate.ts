import { MonteCarloTreeSearchNode } from "./monteCarloTreeSearch";
/**
 * Performs the backpropagation step, updating nodes from the simulation leaf back to the root.
 * @param node The node from which the simulation started.
 * @param result The simulation result (1 for win, 0 for draw, -1 for loss FOR THE PLAYER WHOSE TURN IT WAS AT THE NODE THE SIMULATION STARTED FROM).
 */
export function backpropagate(
  node: MonteCarloTreeSearchNode | null,
  result: number
): void {
  let currentNode = node;
  let currentResult = result;

  while (currentNode !== null) {
    currentNode.visits++;
    currentNode.score += currentResult;

    // Flip the result when going up the tree (parent is opponent)
    currentResult = -currentResult;
    currentNode = currentNode.parent;
  }
}
