import { GameState } from "@/app/types/types";
import {
  WINNING_COMBINATIONS,
  WinningCombination,
} from "../constants/constants";

export const getWinningCombination = (
  board: GameState["board"]
): WinningCombination | null => {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combo;
    }
  }

  return null;
};
