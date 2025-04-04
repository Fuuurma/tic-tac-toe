import { GameState } from "@/app/types/types";
import { GameModes, GameStatus, PlayerSymbol } from "../constants/constants";

export const CanAI_MakeMove = (gameState: GameState) => {
  return (
    gameState.gameMode === GameModes.VS_COMPUTER &&
    gameState.currentPlayer === PlayerSymbol.O &&
    !gameState.winner &&
    gameState.gameStatus === GameStatus.ACTIVE
  );
};
