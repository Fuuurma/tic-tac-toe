import { GameState } from "@/app/types/types";
import { getValidMoves } from "./getValidMoves";

export const findRandomValidMove = (gameState: GameState): number | null => {
  const validMoves = getValidMoves(gameState);

  if (!validMoves || validMoves.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * validMoves.length);

  return validMoves[randomIndex];
};
