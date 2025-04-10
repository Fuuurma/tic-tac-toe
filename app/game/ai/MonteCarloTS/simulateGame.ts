import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";
import { makeMove } from "../../logic/makeMove";
import { checkWinner } from "../../logic/checkWinner";
import { getValidMoves } from "../../logic/getValidMoves";
import { isGameActive } from "../../logic/isGameActive";

/**
 * Simulates a random game from the given state until a terminal state is reached.
 * @param state The starting state for the simulation.
 * @param perspectivePlayer The player from whose perspective the result (+1 win, 0 draw, -1 loss) is calculated.
 * @returns 1 if perspectivePlayer wins, 0 for a draw, -1 if perspectivePlayer loses.
 */

export function simulateRandomGame(
  gameState: GameState,
  perspectivePlayer: PlayerSymbol
): number {
  while (isGameActive(gameState)) {
    const validMoves = getValidMoves(gameState);
    if (validMoves.length === 0) break;

    const randomMove =
      validMoves[Math.floor(Math.random() * validMoves.length)];
    gameState = makeMove(gameState, randomMove);
  }

  const winner = checkWinner(gameState.board);

  switch (winner) {
    case perspectivePlayer:
      return 1;
    case "draw":
      return 0;
    case null:
      return -1;
  }

  return -1; // fallback
}
