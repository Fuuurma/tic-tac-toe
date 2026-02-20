import { BoardPosition, GameState } from "@/app/types/types";
import { computerMove } from "./logic";
import { Socket } from "socket.io-client";
import {
  AI_Difficulty,
  MCTS_ITERATIONS,
  MCTS_TIME_LIMIT,
  PlayerSymbol,
} from "../constants/constants";
import { AI_MoveEngine } from "./AI_MoveEngine";
import { findBestMoveMCTS } from "./MonteCarloTS/findBestMove";
import { findBestMoveMinimax } from "./MiniMaxAlgorithm/findBestMove";
import { getValidMoves } from "../logic/getValidMoves";
import { getAIMove } from "./getAI_Move";
import { makeMove } from "../logic/makeMove";
import { findBestMoveEasyAI } from "./simpleAI/findBestMove";

export const handleAI_Move = (
  state: GameState,
  onLocalUpdate: (newState: GameState) => void,
  difficulty: AI_Difficulty
): (() => void) => {
  const aiMoveDelay = 600; // Delay for user experience

  // Clone the state to prevent potential issues if getAIMove were to mutate (it shouldn't)
  const stateClone = structuredClone(state);

  const timerId = setTimeout(() => {
    console.log(
      `AI (${difficulty}) is thinking... Current state turn: ${stateClone.currentPlayer}`
    );

    // Call the main AI wrapper function to get the best move index
    const bestMoveIndex = getAIMove(stateClone, difficulty);

    if (bestMoveIndex !== -1 && state.board[bestMoveIndex] === null) {
      // Double check validity
      // Use the standalone applyMove function with the original state
      // to ensure correct state progression from the *actual* current state
      // NOTE: Pass the *original* state to applyMove, not the clone used for calculation
      console.log(`AI applying move ${bestMoveIndex} to current state.`);
      const newState = makeMove(state, bestMoveIndex as BoardPosition);
      onLocalUpdate(newState); // Update client state
    } else {
      console.error(
        `AI failed to select a valid move (${bestMoveIndex}) or move was invalid.`
      );
      // Handle error case - maybe skip turn or show message?
      // Maybe attempt fallback to easy?
      const fallbackMoveIndex = findBestMoveEasyAI(state, state.currentPlayer);
      if (fallbackMoveIndex !== -1) {
        console.warn("AI calculation failed, using fallback easy move.");
        const newState = makeMove(state, fallbackMoveIndex as BoardPosition);
        onLocalUpdate(newState);
      } else {
        console.error("Fallback easy move also failed.");
      }
    }
  }, aiMoveDelay);

  // Return cleanup function to clear the timeout
  return () => clearTimeout(timerId);
};

const handleAI_Move_OLD = (
  state: GameState,
  onLocalUpdate: (newState: GameState) => void,
  difficulty: AI_Difficulty
): (() => void) => {
  const aiMoveDelay = 600;

  const timer = setTimeout(() => {
    // is it ok to instantiate a new engine for every AI turn ¿?
    const aiEngine = new AI_MoveEngine(state);
    const newState = aiEngine.getOptimalMove();
    onLocalUpdate(newState);
  }, aiMoveDelay);

  return () => clearTimeout(timer);
};
