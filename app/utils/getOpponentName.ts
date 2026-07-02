import { GameModes } from "../game/constants/constants";
import { GameMode } from "../types/types";
import { match } from "ts-pattern";

export const getOpponentName = (
  gameMode: GameMode,
  opponentName?: string
): string => {
  return match(gameMode)
    .with(GameModes.VS_COMPUTER, () => "Computer")
    .with(GameModes.VS_FRIEND, GameModes.ONLINE, () => opponentName || "Player 2")
    .exhaustive();
};
