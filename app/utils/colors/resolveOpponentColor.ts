import { GameMode } from "@/app/types/types";
import { Color, GameModes } from "@/app/game/constants/constants";
import { findAlternativeColor } from "./findAlternativeColor";

export function resolveOpponentColor(
  gameMode: GameMode,
  playerColor: Color,
  opponentColor: Color
): Color {
  if (gameMode === GameModes.VS_COMPUTER && playerColor === opponentColor) {
    return findAlternativeColor(playerColor);
  }

  return opponentColor;
}
