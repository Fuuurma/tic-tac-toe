import { getInitialGameStatus } from "@/app/utils/getInitialGameStatus";
import { createFreshGameState } from "./newGameState";
import { GameMode, GameState } from "@/app/types/types";
import { Color, PlayerSymbol, PlayerTypes } from "../constants/constants";
import { createPlayerConfig } from "@/app/utils/createPlayerConfig";
import { getOpponentName } from "@/app/utils/getOpponentName";
import { shouldActivateOpponent } from "@/app/utils/shouldActivateOpponent";
import { getOpponentType } from "@/app/utils/getOpponentType";
import { getStartingPlayer } from "@/app/utils/getStartingPlayer";

export const createInitialGameState = (
  username: string,
  gameMode: GameMode,
  options: {
    opponentName?: string;
    playerColor: Color;
    opponentColor: Color;
  }
): GameState => {
  const baseState = createFreshGameState();

  return {
    ...baseState,
    gameMode,
    gameStatus: getInitialGameStatus(gameMode),
    players: {
      [PlayerSymbol.X]: createPlayerConfig({
        username,
        color: options.playerColor,
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: true,
      }),
      [PlayerSymbol.O]: createPlayerConfig({
        username: getOpponentName(gameMode, options.opponentName),
        color: options.opponentColor,
        symbol: PlayerSymbol.O,
        type: getOpponentType(gameMode),
        isActive: shouldActivateOpponent(gameMode),
      }),
    },
    currentPlayer: getStartingPlayer(),
  };
};
