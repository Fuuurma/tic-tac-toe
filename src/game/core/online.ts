import { GameStatus, PlayerSymbol } from "./rules";
import type { GameState } from "./state";

export interface OnlineStatusSnapshot {
  currentPlayer: PlayerSymbol;
  winner: PlayerSymbol | null;
  gameStatus: GameStatus;
  lastMoveIndex: number | null;
}

export const getOnlineStatusSnapshot = (gameState: GameState): OnlineStatusSnapshot => ({
  currentPlayer: gameState.currentPlayer,
  winner: gameState.winner,
  gameStatus: gameState.gameStatus,
  lastMoveIndex: gameState.lastMoveIndex,
});

export const getOnlineStatusMessage = (gameState: GameState): string => {
  if (gameState.winner) {
    return `${gameState.players[gameState.winner]?.username || "Opponent"} wins!`;
  }

  if (gameState.gameStatus === GameStatus.WAITING) {
    return "Waiting for opponent...";
  }

  return `${gameState.players[gameState.currentPlayer]?.username || "Opponent"}'s turn.`;
};

export const shouldAnnounceOnlineUpdate = (
  previous: OnlineStatusSnapshot | null,
  next: OnlineStatusSnapshot
) =>
  !previous ||
  previous.currentPlayer !== next.currentPlayer ||
  previous.winner !== next.winner ||
  previous.gameStatus !== next.gameStatus ||
  previous.lastMoveIndex !== next.lastMoveIndex;
