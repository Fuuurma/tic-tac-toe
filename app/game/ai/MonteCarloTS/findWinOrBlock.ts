import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";
import { getValidMoves } from "../../logic/getValidMoves";
import { makeMove } from "../../logic/makeMove";

// Find immediate win or blocking move
export function findImmediateWinOrBlock(
  state: GameState,
  playerSymbol: PlayerSymbol
): number {
  const validMoves = getValidMoves(state);

  for (const move of validMoves) {
    const simulationState = structuredClone(state);
    simulationState.currentPlayer = playerSymbol;
    const nextState = makeMove(simulationState, move);

    if (nextState.winner === playerSymbol) {
      return move;
    }
  }

  return -1;
}
