import { GameState } from "@/app/types/types";
import { GameStatus } from "../constants/constants";

export function isGameActive(gameState: GameState): boolean {
  return (
    gameState.winner === null && gameState.gameStatus === GameStatus.ACTIVE
  );
}
