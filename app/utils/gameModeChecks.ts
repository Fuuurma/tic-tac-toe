import { GameModes } from "../game/constants/constants";
import { GameState } from "../types/types";

export const isVsComputer = (
  state: GameState
): state is GameState & { gameMode: GameModes.VS_COMPUTER } => {
  return state.gameMode === GameModes.VS_COMPUTER;
};

export const isVsFriend = (
  state: GameState
): state is GameState & { gameMode: GameModes.VS_FRIEND } => {
  return state.gameMode === GameModes.VS_FRIEND;
};

export const isOnlineGame = (
  state: GameState
): state is GameState & { gameMode: GameModes.ONLINE } => {
  return state.gameMode === GameModes.ONLINE;
};
