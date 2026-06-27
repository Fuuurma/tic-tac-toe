import { GameBoard, WinningLine } from "@/app/types/types";
import { PlayerSymbol, WINNING_COMBINATIONS } from "../constants/constants";

interface WinnerResult {
  winner: PlayerSymbol | null;
  winningCombination: WinningLine | null;
}

export const checkWinner = (board: GameBoard, currentPlayer?: PlayerSymbol): WinnerResult => {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a] as PlayerSymbol,
        winningCombination: combination as WinningLine,
      };
    }
  }

  // In the 3-piece variant, a full-board stalemate is not a valid result.
  // If the board somehow fills with no winner, current player loses.
  if (board.every((cell) => cell !== null)) {
    const loser = currentPlayer;
    const winner = loser === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
    return { winner, winningCombination: null };
  }

  return { winner: null, winningCombination: null };
};

// Backward compatibility helper
export const checkWinnerLegacy = (board: GameBoard): PlayerSymbol | null => {
  return checkWinner(board).winner;
};
