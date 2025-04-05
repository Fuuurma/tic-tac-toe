import { GameModes } from "../game/constants/constants";
import { GameMode } from "../types/types";

export const shouldActivateOpponent = (gameMode: GameMode): boolean =>
  gameMode !== GameModes.VS_COMPUTER;
