import { MonteCarloTreeSearchNode } from "./monteCarloTreeSearch";
/**
 * Performs the backpropagation step, updating nodes from the simulation leaf back to the root.
 * @param node The node from which the simulation started.
 * * @param result The simulation result (1 for win, 0 for draw, -1 for loss FOR THE PLAYER WHOSE TURN IT WAS AT THE NODE THE SIMULATION STARTED FROM).
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

// export function backpropagate(
//   node: MonteCarloTreeSearchNode | null,
//   result: number
// ): void {
//    let currentNode = node;
//    let currentResult = result;

//   while (currentNode !== null) {
//     currentNode.visits++;
//     currentNode.score += currentResult;

//     // The result needs to be relative to the player whose turn it is at tempNode
//     // If the player at tempNode is NOT the same as the player at the node below it (where the result came from),
//     // then the result should be flipped (-1 becomes 1, 1 becomes -1, 0 stays 0).
//     // This is because a win for the player below is a loss for the player at tempNode.

//     // Check if the parent exists and if the player is different (meaning turn switched)
//     if (tempNode.parent && tempNode.parent.playerTurn !== tempNode.playerTurn) {
//       // The result passed up is from the perspective of the child's player.
//       // We need to store it from the perspective of the parent's player.
//       currentResult = -currentResult; // Flip win/loss, keep draw (0)
//     }
//     // For the very first node (where simulation started), the result is already correct relative to its player.

//     tempNode.updateNode(currentResult);
//     tempNode = tempNode.parent;
//   }
// }
