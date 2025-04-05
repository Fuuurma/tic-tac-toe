import { GameMode, GameState } from "@/app/types/types";
import {
  Color,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../constants/constants";

// Create a fresh game state for a new game
// Create a fresh game state for a new game
// Create a fresh game state for a new game
// Create a fresh game state for a new game
// Create a fresh game state for a new game

// Specifically for online games
export function createOnlineGameState(): GameState {
  return createGameState(GameModes.ONLINE);
}
