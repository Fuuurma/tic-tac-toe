import { GameMode } from "@/app/types/types";
import { Color, GameModes } from "../constants/constants";

export const VallidateUserInput = (
  username: string,
  opponentName: string,
  gameMode: GameMode,
  userColor: Color,
  opponentColor: Color
) => {
  if (!username) {
    return { isValid: false, message: "Please enter your username." };
  }

  if (gameMode === GameModes.VS_FRIEND) {
    if (!opponentName) {
      return { isValid: false, message: "Please enter opponent's username." };
    }
    if (username === opponentName) {
      return { isValid: false, message: "Player names must be different." };
    }
    if (userColor === opponentColor) {
      return {
        isValid: false,
        message: "Players must choose different colors.",
      };
    }
  }
  return { isValid: true, message: null };
};
