import { GameState } from "@/app/types/types";
import { GameModes, GameStatus, PlayerSymbol } from "../constants/constants";

export const isAITurn = (state: GameState): boolean => {
  return (
    state.gameMode === GameModes.VS_COMPUTER &&
    state.currentPlayer === PlayerSymbol.O &&
    !state.winner &&
    state.gameStatus === GameStatus.ACTIVE
  );
};
