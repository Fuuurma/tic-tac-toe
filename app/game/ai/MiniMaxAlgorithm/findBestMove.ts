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

  const validMoves = getValidMoves(currentState);
  const humanSymbol =
    aiSymbol === PlayerSymbol.O ? PlayerSymbol.X : PlayerSymbol.O;

  // console.log("--- Minimax Analysis ---");
  // console.log("Current board state:", currentState.board);
  // console.log("AI is playing as:", aiSymbol);
  // console.log("Valid moves:", validMoves);

  for (const move of validMoves) {
    const newState = makeMove(
      structuredClone(currentState),
      move as BoardPosition
    );
    if (newState.winner === aiSymbol) {
      return move;
    }
  }

  // Then, check for moves to block opponent from winning
  for (const move of validMoves) {
    const simulationState = structuredClone(currentState);
    simulationState.currentPlayer = humanSymbol;
    const opponentMoveSimulation = makeMove(
      simulationState,
      move as BoardPosition
    );

    if (opponentMoveSimulation.winner === humanSymbol) {
      return move;
    }
  }

  // If no immediate win or block, use minimax for optimal play
  let bestMove = -1;
  let bestScore = -Infinity;
  let bestMoves: number[] = [];

  for (const move of validMoves) {
    const newState = makeMove(
      structuredClone(currentState),
      move as BoardPosition
    );

    const score = minimax(
      newState,
      0,
      -Infinity,
      Infinity,
      false,
      aiSymbol,
      maxDepth
    );

    // console.log(`Move ${move} evaluated with score: ${score}`);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  if (bestMoves.length > 1) {
    const randomIndex = Math.floor(Math.random() * bestMoves.length);
    bestMove = bestMoves[randomIndex];
  }

  // console.log(`Minimax chosen move: ${bestMove} with score: ${bestScore}`);

  return bestMove;
}
