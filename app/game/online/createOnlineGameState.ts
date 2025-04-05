import { GameMode, GameState, PlayerConfig } from "@/app/types/types";
import {
  Color,
  GAME_RULES,
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../constants/constants";

// Create a fresh game state for a new game
export function createGameState(
  gameMode: GameMode,
  options?: {
    username?: string;
    opponentName?: string;
    playerColor?: Color;
    opponentColor?: Color;
  }
): GameState {
  const {
    username = "",
    opponentName = "Opponent",
    playerColor,
    opponentColor,
  } = options || {};

  // Initialize players based on game mode
  const players: Record<PlayerSymbol, PlayerConfig> = {
    [PlayerSymbol.X]: {
      username: gameMode === GameModes.ONLINE ? "" : username,
      symbol: PlayerSymbol.X,
      color: playerColor || PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
      type: PlayerTypes.HUMAN,
      isActive: true,
    },
    [PlayerSymbol.O]: {
      username:
        gameMode === GameModes.ONLINE
          ? ""
          : gameMode === GameModes.VS_COMPUTER
          ? "Computer"
          : opponentName,
      symbol: PlayerSymbol.O,
      color: opponentColor || PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
      type:
        gameMode === GameModes.VS_COMPUTER
          ? PlayerTypes.COMPUTER
          : PlayerTypes.HUMAN,
      isActive: true,
    },
  };

  return {
    board: Array(9).fill(null),
    currentPlayer: PlayerSymbol.X,
    winner: null,
    players,
    moves: {
      [PlayerSymbol.X]: [],
      [PlayerSymbol.O]: [],
    },
    gameMode: gameMode,
    nextToRemove: {
      [PlayerSymbol.X]: null,
      [PlayerSymbol.O]: null,
    },
    maxMoves: GAME_RULES.MAX_MOVES_PER_PLAYER,
    gameStatus: GameStatus.WAITING,
  };
}

// Specifically for online games
export function createOnlineGameState(): GameState {
  return createGameState(GameModes.ONLINE);
}
