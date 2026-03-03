import { GameBoard, PlayerType, WinningLine } from "@/app/types/types";
import { PlayerSymbol, WINNING_COMBINATIONS } from "../constants/constants";

interface WinnerResult {
  winner: PlayerSymbol | "draw" | null;
  winningCombination: WinningLine | null;
}

export const checkWinner = (board: GameBoard): WinnerResult => {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a] as PlayerSymbol,
        winningCombination: combination as WinningLine,
      };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: "draw", winningCombination: null };
  }

  return { winner: null, winningCombination: null };
};

// Backward compatibility helper
export const checkWinnerLegacy = (board: GameBoard): PlayerSymbol | "draw" | null => {
  return checkWinner(board).winner;
};
