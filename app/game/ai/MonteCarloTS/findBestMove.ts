import { GameState } from "@/app/types/types";
import { MonteCarloTreeSearchNode } from "./monteCarloTreeSearch";
import { simulateRandomGame } from "./simulateGame";
import { isGameActive } from "../../logic/isGameActive";
import { getValidMoves } from "../../logic/getValidMoves";
import { backpropagate } from "./backPropagate";
import { makeMove } from "../../logic/makeMove";
import { PlayerSymbol } from "../../constants/constants";
import { selectBestMoveFromRoot } from "./getBestMoveFromRoot";

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
  const rootState = structuredClone(currentState);

  const rootPlayer = rootNode.playerTurn;

  // First, check for immediate winning moves (extra logic for stronger play)
  const immediateWin = findImmediateWinOrBlock(
    rootState,
    rootState.currentPlayer
  );
  if (immediateWin !== -1) {
    console.log(`Found immediate winning move: ${immediateWin}`);
    return immediateWin;
  }

  // Then check for blocking opponent's winning moves
  const opponentSymbol =
    rootState.currentPlayer === PlayerSymbol.X
      ? PlayerSymbol.O
      : PlayerSymbol.X;
  const blockingMove = findImmediateWinOrBlock(rootState, opponentSymbol);
  if (blockingMove !== -1) {
    console.log(`Found blocking move: ${blockingMove}`);
    return blockingMove;
  }

  // Run MCTS iterations
  for (let i = 0; i < iterations; i++) {
    // 1. Selection: Select path through tree
    let node = rootNode;
    let currentState = structuredClone(rootState);

    // Select until we reach a leaf node or a node not fully expanded
    while (!node.isTerminalNode && node.isFullyExpanded) {
      const bestChild = node.selectBestChild(explorationParameter);
      if (!bestChild) break;

      // Apply the move that leads to this child
      let moveToChild = -1;
      for (const [move, child] of node.children.entries()) {
        if (child === bestChild) {
          moveToChild = move;
          break;
        }
      }

      if (moveToChild !== -1) {
        currentState = makeMove(structuredClone(currentState), moveToChild);
        node = bestChild;
      } else {
        break; // Should not happen with proper implementation
      }
    }

    // 2. Expansion: Add a new child node if possible
    if (!node.isTerminalNode && !node.isFullyExpanded) {
      const expandedNode = node.expand();
      if (expandedNode) {
        // Apply the move that leads to expanded node
        let moveToChild = -1;
        for (const [move, child] of node.children.entries()) {
          if (child === expandedNode) {
            moveToChild = move;
            break;
          }
        }

        if (moveToChild !== -1) {
          currentState = makeMove(structuredClone(currentState), moveToChild);
          node = expandedNode;
        }
      }
    }

    // 3. Simulation: Play random moves until game end
    const result = simulateRandomGame(
      structuredClone(currentState),
      node.playerTurn
    );

    // 4. Backpropagation: Update scores up the tree
    backpropagate(node, result);
  }

  // After all iterations, choose the best move from root's children
  return selectBestMoveFromRoot(rootNode);
}
