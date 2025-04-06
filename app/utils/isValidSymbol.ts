import { PlayerSymbol } from "../game/constants/constants";

export const isValidPlayerSymbol = (symbol: any): symbol is PlayerSymbol => {
  return Object.values(PlayerSymbol).includes(symbol);
};
