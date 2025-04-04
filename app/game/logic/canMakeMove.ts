import { GameMode } from "@/app/types/types";
import { GameModes, PlayerSymbol } from "../constants/constants";

export const CanMakeMove = (
  gameMode: GameMode,
  currentPlayer: PlayerSymbol,
  playerSymbol: PlayerSymbol | null
) => {
  switch (gameMode) {
    case GameModes.VS_FRIEND:
      // In local 2-player mode, always allow moves regardless of player symbol
      // The board's currentPlayer will manage whose turn it is
      return true;

    case GameModes.VS_COMPUTER:
      // For vs computer, only allow moves when it's the human's turn (X)
      return currentPlayer === PlayerSymbol.X;

    case GameModes.ONLINE:
      // For online play, only allow moves on your assigned symbol's turn
      return currentPlayer === playerSymbol;

    default:
      return currentPlayer === playerSymbol;
  }
};
