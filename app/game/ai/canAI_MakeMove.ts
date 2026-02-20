import { GameState, GameMode } from "@/app/types/types";
import { GameModes } from "../constants/constants";
import { PlayerSymbol } from "../constants/constants";

export function isAITurn(gameState: GameState): boolean {
  return (
    gameState.gameMode === GameModes.VS_COMPUTER &&
    gameState.currentPlayer === "O" &&
    gameState.winner === null &&
    gameState.gameStatus === "active"
  );
}
