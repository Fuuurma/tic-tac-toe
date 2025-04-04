import { GameState } from "@/app/types/types";
import {
  GameModes,
  GameStatus,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
} from "../constants/constants";

export const createFreshGameState = (): GameState => {
  return {
    board: Array(9).fill(null),
    currentPlayer: PlayerSymbol.X,
    winner: null,
    players: {
      [PlayerSymbol.X]: {
        username: "",
        color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
        symbol: PlayerSymbol.X,
        type: PlayerTypes.HUMAN,
        isActive: false,
      },
      [PlayerSymbol.O]: {
        username: "",
        color: PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
        symbol: PlayerSymbol.O,
        type: PlayerTypes.HUMAN,
        isActive: false,
      },
    },
    moves: {
      [PlayerSymbol.X]: [],
      [PlayerSymbol.O]: [],
    },
    gameMode: GameModes.VS_COMPUTER,
    nextToRemove: { [PlayerSymbol.X]: null, [PlayerSymbol.O]: null },
    maxMoves: 3,

    gameStatus: GameStatus.WAITING,
  };
};
