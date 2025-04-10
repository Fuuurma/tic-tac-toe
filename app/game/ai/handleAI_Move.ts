import { GameState } from "@/app/types/types";
import { computerMove } from "./logic";
import { Socket } from "socket.io-client";
import { AI_Difficulty, PlayerSymbol } from "../constants/constants";
import { AI_MoveEngine } from "./AI_MoveEngine";

export const handleAI_Move = (
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
