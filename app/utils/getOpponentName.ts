import { GameModes } from "../game/constants/constants";
import { GameMode } from "../types/types";

export const getOpponentName = (
  gameMode: GameMode,
  opponentName?: string
): string => {
  switch (gameMode) {
    case GameModes.VS_COMPUTER:
      return "Computer";
    case GameModes.VS_FRIEND:
    case GameModes.ONLINE:
      return opponentName || "Player 2";
    default:
      return "Opponent";
  }
};
