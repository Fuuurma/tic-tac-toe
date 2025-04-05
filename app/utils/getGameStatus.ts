import { GameStatus, PlayerSymbol } from "../game/constants/constants";
import { GameState } from "../types/types";

// For complex state derivation
export const getGameStatus = (state: GameState) => ({
  isActive: state.gameStatus === GameStatus.ACTIVE,
  isPlayersTurn: state.currentPlayer === PlayerSymbol.X,
});
