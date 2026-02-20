import { GameState, GameMode } from "@/app/types/types";
import { GameModes, GameStatus, PlayerSymbol } from "../constants/constants";

export function isAITurn(gameState: GameState): boolean {
  return (
    gameState.gameMode === GameModes.VS_COMPUTER &&
    gameState.currentPlayer === PlayerSymbol.O &&
    gameState.winner === null &&
    gameState.gameStatus === GameStatus.ACTIVE
  );
}
