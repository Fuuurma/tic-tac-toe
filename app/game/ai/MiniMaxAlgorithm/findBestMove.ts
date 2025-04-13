import { BoardPosition, GameState } from "@/app/types/types";
import { minimax } from "./miniMax";
import { PlayerSymbol } from "../../constants/constants";
import { getValidMoves } from "../../logic/getValidMoves";
import { makeMove } from "../../logic/makeMove";
import { isGameActive } from "../../logic/isGameActive";

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
  maxDepth: number = 9
): number {
  if (!isGameActive(currentState)) {
    throw new Error("Cannot find move for terminal state.");
  }

  // Get all valid moves
  const validMoves = getValidMoves(currentState);
  const humanSymbol =
    aiSymbol === PlayerSymbol.O ? PlayerSymbol.X : PlayerSymbol.O;

  console.log("--- Minimax Analysis ---");
  console.log("Current board state:", currentState.board);
  console.log("AI is playing as:", aiSymbol);
  console.log("Valid moves:", validMoves);

  // First, check for immediate winning moves
  for (const move of validMoves) {
    const newState = makeMove(
      structuredClone(currentState),
      move as BoardPosition
    );
    if (newState.winner === aiSymbol) {
      console.log(`Found immediate winning move: ${move}`);
      return move;
    }
  }

  // Then, check for moves to block opponent from winning
  for (const move of validMoves) {
    // Create a simulation where opponent plays in this position
    const simulationState = structuredClone(currentState);
    simulationState.currentPlayer = humanSymbol;
    const opponentMoveSimulation = makeMove(
      simulationState,
      move as BoardPosition
    );

    if (opponentMoveSimulation.winner === humanSymbol) {
      console.log(`Found blocking move to prevent opponent win: ${move}`);
      return move;
    }
  }

  // If no immediate win or block needed, use minimax for optimal play
  let bestMove = -1;
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const move of validMoves) {
    // Create a fresh copy of state for each potential move
    const newState = makeMove(
      structuredClone(currentState),
      move as BoardPosition
    );

    // Call minimax to evaluate this move
    const score = minimax(
      newState,
      0,
      -Infinity,
      Infinity,
      false, // After AI moves, it's opponent's turn (minimizing)
      aiSymbol,
      maxDepth
    );

    console.log(`Move ${move} evaluated with score: ${score}`);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  // If multiple moves have the same score, choose randomly
  if (bestMoves.length > 1) {
    const randomIndex = Math.floor(Math.random() * bestMoves.length);
    bestMove = bestMoves[randomIndex];
    console.log(
      `Multiple best moves with score ${bestScore}. Randomly selected: ${bestMove}`
    );
  }

  console.log(`Minimax chosen move: ${bestMove} with score: ${bestScore}`);
  console.log("-----------------------");

  return bestMove;
}
