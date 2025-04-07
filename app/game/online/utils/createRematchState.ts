import { GameState, PlayerConfig } from "@/app/types/types";
import { GameStatus, PlayerSymbol } from "../../constants/constants";
import { createOnlineGameState } from "../createOnlineGameState";

/**
 * Creates a fresh game state for a rematch
 * @param currentPlayersData The current players data to preserve
 * @returns A new game state with the same players
 */

export function createRematchGameState(
  currentPlayersData: Record<PlayerSymbol, PlayerConfig>
): GameState {
  return {
    ...createOnlineGameState(),
    players: currentPlayersData,
    gameStatus: GameStatus.ACTIVE,
    currentPlayer: PlayerSymbol.X,
  };
}
