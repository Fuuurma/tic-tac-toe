import { GameMode } from "@/app/types/types";
import { GameModes, PlayerSymbol } from "../constants/constants";
import { match } from "ts-pattern";

export const CanMakeMove = (
  gameMode: GameMode,
  currentPlayer: PlayerSymbol,
  playerSymbol: PlayerSymbol | null
) => {
  return match(gameMode)
    .with(GameModes.VS_FRIEND, () => true)
    .with(GameModes.VS_COMPUTER, () => currentPlayer === PlayerSymbol.X)
    .with(GameModes.ONLINE, () => currentPlayer === playerSymbol)
    .exhaustive();
};
