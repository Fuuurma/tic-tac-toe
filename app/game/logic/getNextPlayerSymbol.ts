import { PlayerSymbol } from "../constants/constants";

export const getNextPlayerSymbol = (
  currentPlayer: PlayerSymbol
): PlayerSymbol => {
  return currentPlayer === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
};
