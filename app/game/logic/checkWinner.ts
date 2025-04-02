import { GameBoard, PlayerType } from "@/app/types/types";
import { PlayerSymbol, WINNING_COMBINATIONS } from "../constants/constants";

export const checkWinner = (board: GameBoard): PlayerSymbol | "draw" | null => {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as PlayerSymbol;
    }
  }

  if (board.every((cell) => cell !== null)) {
    return "draw";
  }

  return null;
};
