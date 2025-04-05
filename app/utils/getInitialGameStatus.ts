import { GameModes, GameStatus } from "../game/constants/constants";
import { GameMode } from "../types/types";

export const getInitialGameStatus = (gameMode: GameMode): GameStatus =>
  [GameModes.VS_COMPUTER, GameModes.VS_FRIEND].includes(gameMode)
    ? GameStatus.ACTIVE
    : GameStatus.WAITING;
