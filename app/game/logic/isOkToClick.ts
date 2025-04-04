import { GameState } from "@/app/types/types";
import { GameStatus } from "../constants/constants";

export const IsOkToClick = (
  loggedIn: boolean,
  gameState: GameState,
  cellIndex: number
) => {
  return (
    loggedIn &&
    !gameState.winner &&
    gameState.gameStatus === GameStatus.ACTIVE &&
    gameState.board[cellIndex] !== null
  );
};
