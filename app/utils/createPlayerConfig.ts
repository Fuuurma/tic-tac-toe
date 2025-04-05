import { Color, PlayerSymbol } from "../game/constants/constants";
import { PlayerConfig, PlayerType } from "../types/types";

export const createPlayerConfig = (params: {
  username: string;
  color: Color;
  symbol: PlayerSymbol;
  type: PlayerType;
  isActive: boolean;
}): PlayerConfig => ({
  username: params.username,
  color: params.color,
  symbol: params.symbol,
  type: params.type,
  isActive: params.isActive,
});
