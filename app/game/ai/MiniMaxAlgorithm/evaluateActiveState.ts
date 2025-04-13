import { GameState } from "@/app/types/types";
import {
  CENTER_POSITION,
  CORNER_POSITIONS,
  PlayerSymbol,
  WINNING_COMBINATIONS,
} from "../../constants/constants";

export function evaluateActiveState(
  gameState: GameState,
  AI_Symbol: PlayerSymbol
): number {
  // console.log("Evaluating Active Game State...");

  // Non-terminal state evaluation (heuristic scoring)
  const humanSymbol =
    AI_Symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  const board = gameState.board;
  let score = 0;

  // Analyze each line

  for (const [a, b, c] of WINNING_COMBINATIONS) {
    const lineSymbols = [board[a], board[b], board[c]];

    // Count symbols in this line
    const aiCount = lineSymbols.filter((s) => s === AI_Symbol).length;
    const humanCount = lineSymbols.filter((s) => s === humanSymbol).length;
    const emptyCount = lineSymbols.filter((s) => s === null).length;

    // Scoring logic
    if (aiCount === 2 && emptyCount === 1) {
      score += 100; // AI can win next move
    } else if (humanCount === 2 && emptyCount === 1) {
      score -= 90; // Need to block opponent
    } else if (aiCount === 1 && emptyCount === 2) {
      score += 10; // Potential future line
    } else if (humanCount === 1 && emptyCount === 2) {
      score -= 8; // Opponent potential line
    }
  }

  // Center position is valuable
  if (board[CENTER_POSITION] === AI_Symbol) {
    score += 20;
  } else if (board[CENTER_POSITION] === humanSymbol) {
    score -= 20;
  }

  for (const corner of CORNER_POSITIONS) {
    if (board[corner] === AI_Symbol) {
      score += 5;
    } else if (board[corner] === humanSymbol) {
      score -= 5;
    }
  }

  return score;
}
