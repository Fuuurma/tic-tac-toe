import { GameState } from "@/app/types/types";
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

export const handleAI_Move = (
  state: GameState,
  onLocalUpdate: (newState: GameState) => void,
  difficulty: AI_Difficulty
): (() => void) => {
  const aiMoveDelay = 600;

  const timer = setTimeout(() => {
    // is it ok to instantiate a new engine for every AI turn ¿?
    // const aiEngine = new AI_MoveEngine(state);
    // const newState = aiEngine.getOptimalMove();
    // onLocalUpdate(newState);

    // NEW:

    let gameStateClone = structuredClone(state);

    const startTime = performance.now();
    let bestMove = -1;
    const aiSymbol = gameStateClone.currentPlayer;

    switch (difficulty) {
      // case AI_Difficulty.EASY:
      //   console.log("AI Difficulty: EASY (Rule-Based)");
      //   bestMove = findBestMoveEasy(gameState, aiSymbol);
      //   break;

      case AI_Difficulty.EASY:
        const aiEngine = new AI_MoveEngine(state);
        const newState = aiEngine.getOptimalMove();
        onLocalUpdate(newState);
        break;

      case AI_Difficulty.NORMAL:
      case AI_Difficulty.HARD:
        console.log(`AI Difficulty: ${difficulty.toUpperCase()} (MCTS)`);
        const iterations = MCTS_ITERATIONS[difficulty];
        const timeLimit = MCTS_TIME_LIMIT[difficulty];
        // Pass both iterations and time limit to MCTS
        bestMove = findBestMoveMCTS(gameStateClone, iterations);
        break;

      case AI_Difficulty.INSANE:
        console.log("AI Difficulty: INSANE (Minimax)");
        // Depth can be adjusted. For modified TicTacToe, 9 might be safe,
        // but test performance.
        bestMove = findBestMoveMinimax(gameStateClone, aiSymbol, 9);
        break;

      default:
        console.warn(
          `Unknown AI difficulty: ${difficulty}. Falling back to EASY.`
        );
        // bestMove = findBestMoveEasy(gameState, aiSymbol);
        break;
    }

    const endTime = performance.now();
    console.log(
      `AI (${difficulty}) chose move ${bestMove} in ${(
        endTime - startTime
      ).toFixed(2)} ms`
    );

    // Final safety check
    if (!getValidMoves(gameState).includes(bestMove)) {
      console.error(
        `AI (${difficulty}) chose an invalid move: ${bestMove}. Falling back.`
      );
      const validMoves = getValidMoves(gameState);
      return validMoves.length > 0 ? validMoves[0] : -1;
    }

    return bestMove;
  }, aiMoveDelay);

  return () => clearTimeout(timer);
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
