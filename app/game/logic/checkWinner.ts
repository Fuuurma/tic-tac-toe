import { GameBoard, WinningLine } from "@/app/types/types";
import { PlayerSymbol, WINNING_COMBINATIONS } from "../constants/constants";

interface WinnerResult {
  winner: PlayerSymbol | null;
  winningCombination: WinningLine | null;
}

export const checkWinner = (board: GameBoard, _currentPlayer?: PlayerSymbol): WinnerResult => {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a] as PlayerSymbol,
        winningCombination: combination as WinningLine,
      };
    }
  }

  // In the 3-piece variant, players remove their oldest piece before a fourth
  // placement, so a full board is stale/corrupt state rather than a result.
  if (board.every((cell) => cell !== null)) {
    return { winner: null, winningCombination: null };
  }

  return { winner: null, winningCombination: null };
};

// Backward compatibility helper
export const checkWinnerLegacy = (board: GameBoard): PlayerSymbol | null => {
  return checkWinner(board).winner;
};
