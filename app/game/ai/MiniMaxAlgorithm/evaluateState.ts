// Heuristic evaluation of a terminal state

import { GameState } from "@/app/types/types";
import { PlayerSymbol } from "../../constants/constants";

// Perspective of the AI (maximizing player)
export function evaluateState(
  state: GameState,
  AI_Symbol: PlayerSymbol
): number {
  const winner = state.winner; // Or use state.winner
  if (winner === AI_Symbol) {
    return 10; // AI wins - High positive score
  } else if (winner && winner !== "draw") {
    return -10; // Opponent wins - High negative score
  } else {
    return 0; // Draw or non-terminal state (less useful here)
  }

  // new...
  // Non-terminal state evaluation (heuristic scoring)
  const humanSymbol =
    AI_Symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;
  const board = state.board;
  let score = 0;

  // Define winning lines
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // Rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // Columns
    [0, 4, 8],
    [2, 4, 6], // Diagonals
  ];

  // Analyze each line
  for (const [a, b, c] of lines) {
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
  if (board[4] === AI_Symbol) {
    score += 20;
  } else if (board[4] === humanSymbol) {
    score -= 20;
  }
  const corners = [0, 2, 6, 8];
  for (const corner of corners) {
    if (board[corner] === AI_Symbol) {
      score += 5;
    } else if (board[corner] === humanSymbol) {
      score -= 5;
    }
  }

  if (!AI_Symbol) {
    switch (winner) {
      case null:
        if (AI_Symbol) {
          return 0;
        }

      case "draw":
        if (AI_Symbol) {
          return 0;
        }

      case PlayerSymbol.X:
        if (AI_Symbol) {
          return 1;
        }

      case PlayerSymbol.O:
        if (AI_Symbol) {
          return -1;
        }
    }
  }

  return score;
}
