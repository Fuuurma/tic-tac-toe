import { PlayerSymbol } from "../game/constants/constants";

/**
 * Randomly selects which player (X or O) starts the game
 * @returns PlayerSymbol - Either X or O
 */

export function getStartingPlayer(): PlayerSymbol {
  const random = Math.random();

  return random < 0.5 ? PlayerSymbol.X : PlayerSymbol.O;
}
