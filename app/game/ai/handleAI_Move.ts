import { BoardPosition, GameState } from "@/app/types/types";
import {
  AI_Difficulty,
  PlayerSymbol,
} from "../constants/constants";
import { getAIMove } from "./getAI_Move";
import { makeMove } from "../logic/makeMove";
import { findBestMoveEasyAI } from "./simpleAI/findBestMove";
import { isValidMove } from "../logic/isValidMove";

export const handleAI_Move = (
  state: GameState,
  onLocalUpdate: (newState: GameState) => void,
  difficulty: AI_Difficulty
): (() => void) => {
  const aiMoveDelay = 600;

  // Store the expected game state snapshot to detect race conditions
  const expectedPlayer = state.currentPlayer;
  const expectedBoardHash = state.board.join(",");

  const timerId = setTimeout(() => {
    console.log(
      `AI (${difficulty}) is thinking... Current state turn: ${expectedPlayer}`
    );

    // Call the main AI wrapper function to get the best move index
    // Clone state for calculation to prevent any mutations
    const stateClone = structuredClone(state);
    const bestMoveIndex = getAIMove(stateClone, difficulty);

    // Race condition check: Verify the move is still valid
    // The cell must still be null and it must still be AI's turn
    if (bestMoveIndex !== -1 && 
        bestMoveIndex >= 0 && 
        bestMoveIndex < state.board.length &&
        state.board[bestMoveIndex] === null &&
        state.currentPlayer === expectedPlayer) {
      
      console.log(`AI applying move ${bestMoveIndex} to current state.`);
      const newState = makeMove(state, bestMoveIndex as BoardPosition);
      onLocalUpdate(newState);
    } else {
      console.error(
        `AI failed to select a valid move (${bestMoveIndex}) or move was invalid. ` +
        `Board[${bestMoveIndex}]=${state.board[bestMoveIndex]}, ` +
        `CurrentPlayer=${state.currentPlayer}, Expected=${expectedPlayer}`
      );
      
      // Attempt fallback
      const fallbackMoveIndex = findBestMoveEasyAI(state, expectedPlayer);
      if (fallbackMoveIndex !== -1 && 
          fallbackMoveIndex >= 0 &&
          fallbackMoveIndex < state.board.length &&
          state.board[fallbackMoveIndex] === null &&
          state.currentPlayer === expectedPlayer) {
        console.warn("AI calculation failed, using fallback easy move.");
        const newState = makeMove(state, fallbackMoveIndex as BoardPosition);
        onLocalUpdate(newState);
      } else {
        console.error("Fallback easy move also failed. Game may be stuck.");
      }
    }
  }, aiMoveDelay);

  return () => clearTimeout(timerId);
};
