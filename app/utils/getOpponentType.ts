import { GameModes, PlayerTypes } from "../game/constants/constants";
import { GameMode, PlayerType } from "../types/types";

export const getOpponentType = (gameMode: GameMode): PlayerType =>
  gameMode === GameModes.VS_COMPUTER ? PlayerTypes.COMPUTER : PlayerTypes.HUMAN;
