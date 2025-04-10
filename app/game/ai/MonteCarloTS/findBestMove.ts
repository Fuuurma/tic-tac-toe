import { GameState } from "@/app/types/types";
import { MonteCarloTreeSearchNode } from "./monteCarloTreeSearch";
import { backpropagate } from "../backPropagate";
import { simulateRandomGame } from "./simulateGame";
import { isGameActive } from "../../logic/isGameActive";
import { getValidMoves } from "../../logic/getValidMoves";

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
  if (!isGameActive(currentState)) {
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

    // 2. Expansion
    let simulationNode: MonteCarloTreeSearchNode = node; // Node to start simulation from
    if (!node.isTerminalNode && !node.isFullyExpanded) {
      const expandedNode = node.expand();
      if (expandedNode) {
        simulationNode = expandedNode;
      }
      // If expand returned null (shouldn't happen here), simulation starts from 'node'
    }

    // 3. Simulation
    // Result is from the perspective of the player whose turn it is at simulationNode
    const simulationResult = simulateRandomGame(
      simulationNode.state,
      simulationNode.playerTurn
    );

    // 4. Backpropagation
    // Backpropagate expects result relative to the player at the node being updated
    // Initial result IS relative to simulationNode.playerWhoseTurnItIs. Backpropagate handles flipping.
    backpropagate(simulationNode, simulationResult);
  }

  // After iterations, choose the best move from the root node's children
  let bestMove = -1;
  let highestScore = -Infinity; // Or highest visits, depending on strategy
  // let mostVisits = -1;

  if (rootNode.children.size === 0) {
    // No simulations run or no valid moves? Fallback needed.
    console.warn("MCTS root has no children after iterations. Falling back.");
    const validMoves = getValidMoves(currentState);
    return validMoves.length > 0 ? validMoves[0] : -1; // Fallback: first valid move
  }

  console.log("--- MCTS Results ---");
  for (const [move, child] of rootNode.children.entries()) {
    if (child.visits > 0) {
      const winRate = (child.score / child.visits).toFixed(3); // Score might include draws as 0.5
      console.log(
        `Move: ${move}, Score: ${child.score.toFixed(1)}, Visits: ${
          child.visits
        }, WinRate (approx): ${winRate}`
      );
      // Choose based on highest score (favors wins, includes draws) or highest visits
      if (child.score / child.visits > highestScore) {
        // Using average score (win rate)
        highestScore = child.score / child.visits;
        bestMove = move;
      }
      // Or choose based on most visits (robust choice)
      // if (child.visits > mostVisits) {
      //     mostVisits = child.visits;
      //     bestMove = move;
      // }
    } else {
      console.log(`Move: ${move}, Score: 0, Visits: 0`);
    }
  }

  console.log("--------------------");

  if (bestMove === -1) {
    // If all children have 0 visits or scores are problematic, pick robustly
    let mostVisits = -1;
    for (const [move, child] of rootNode.children.entries()) {
      if (child.visits > mostVisits) {
        mostVisits = child.visits;
        bestMove = move;
      }
    }
    if (bestMove === -1) {
      // Still nothing? Very rare. Fallback.
      const validMoves = getValidMoves(currentState);
      bestMove = validMoves.length > 0 ? validMoves[0] : -1;
    }
    console.log(`Choosing best move based on visits: ${bestMove}`);
  } else {
    console.log(`Choosing best move based on score: ${bestMove}`);
  }

  return bestMove;
}
