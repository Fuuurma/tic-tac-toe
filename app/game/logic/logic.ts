import { GameBoard, GameState, PlayerType } from "@/app/types/types";
import { checkWinner } from "./checkWinner";
import { winningCombinations } from "../constants/constants";

export const initialGameState: GameState = {
  board: Array(9).fill(null),
  currentPlayer: "X",
  winner: null,
  players: {
    X: null,
    O: null,
  },
  moves: {
    X: [],
    O: [],
  },
  gameMode: "human",
};
