import { GameState } from "@/app/types/types";
import { GameStatus } from "../constants/constants";

export const isValidMove = (
  state: GameState,
  cellIndex: number,
  isLoggedIn: boolean
): boolean => {
  return (
    isLoggedIn &&
    state.gameStatus === GameStatus.ACTIVE &&
    !state.winner &&
    state.board[cellIndex] === null
  );
};
