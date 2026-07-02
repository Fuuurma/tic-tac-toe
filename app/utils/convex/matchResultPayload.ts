import { GameModes, GameStatus, PlayerSymbol } from "@/app/game/constants/constants";
import type { GameMode, GameState, PlayerConfig } from "@/app/types/types";
import type { Id } from "@/convex/_generated/dataModel";

type MatchSource = "socket" | "local" | "ai";

interface PlayerResultPayload {
  profileId?: Id<"profiles">;
  guestId?: string;
  displayNameSnapshot: string;
}

export interface MatchResultPayload {
  gameMode: GameMode;
  source: MatchSource;
  movesCount: number;
  dedupeKey?: string;
  winner: PlayerResultPayload;
  loser: PlayerResultPayload;
}

const sourceByGameMode: Record<GameMode, MatchSource> = {
  [GameModes.ONLINE]: "socket",
  [GameModes.VS_FRIEND]: "local",
  [GameModes.VS_COMPUTER]: "ai",
};

const getOpponentSymbol = (symbol: PlayerSymbol) =>
  symbol === PlayerSymbol.X ? PlayerSymbol.O : PlayerSymbol.X;

const playerIdentityPayload = (player: PlayerConfig | undefined): PlayerResultPayload | null => {
  if (!player?.profileId && !player?.guestId) {
    return null;
  }

  return {
    ...(player.profileId ? { profileId: player.profileId as Id<"profiles"> } : {}),
    ...(player.guestId ? { guestId: player.guestId } : {}),
    displayNameSnapshot: player.username || `Player ${player.symbol}`,
  };
};

export const buildMatchResultPayload = (gameState: GameState): MatchResultPayload | null => {
  if (gameState.gameStatus !== GameStatus.COMPLETED || !gameState.winner) {
    return null;
  }

  const loserSymbol = getOpponentSymbol(gameState.winner);
  const winner = playerIdentityPayload(gameState.players[gameState.winner]);
  const loser = playerIdentityPayload(gameState.players[loserSymbol]);

  if (!winner || !loser) {
    return null;
  }

  return {
    gameMode: gameState.gameMode,
    source: sourceByGameMode[gameState.gameMode],
    movesCount: gameState.moveCount,
    winner,
    loser,
  };
};
