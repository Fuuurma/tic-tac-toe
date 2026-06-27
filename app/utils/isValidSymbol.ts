import { PlayerSymbol } from "../game/constants/constants";

export const isValidPlayerSymbol = (symbol: unknown): symbol is PlayerSymbol => {
  return Object.values(PlayerSymbol).includes(symbol as PlayerSymbol);
};
