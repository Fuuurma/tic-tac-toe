import { useCallback, useEffect, useState } from "react";
import { getOrCreateGuestIdentity } from "@/lib/identity";

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

const DEFAULT_STATS: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
};

const storageKey = (guestId: string) => `tic-tac-toe:stats:${guestId}`;

const readStats = (guestId: string): GameStats => {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = window.localStorage.getItem(storageKey(guestId));
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw) as Partial<GameStats>;
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return DEFAULT_STATS;
  }
};

const writeStats = (guestId: string, stats: GameStats): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(guestId), JSON.stringify(stats));
};

export function useGameStats() {
  const [stats, setStats] = useState<GameStats>(DEFAULT_STATS);
  const [guestId, setGuestId] = useState<string>("");

  useEffect(() => {
    const identity = getOrCreateGuestIdentity();
    setGuestId(identity.guestId);
    setStats(readStats(identity.guestId));
  }, []);

  const recordWin = useCallback(() => {
    setStats((prev) => {
      if (!guestId) return prev;
      const currentStreak = prev.currentWinStreak + 1;
      const next: GameStats = {
        ...prev,
        totalGames: prev.totalGames + 1,
        wins: prev.wins + 1,
        currentWinStreak: currentStreak,
        bestWinStreak: Math.max(prev.bestWinStreak, currentStreak),
      };
      writeStats(guestId, next);
      return next;
    });
  }, [guestId]);

  const recordLoss = useCallback(() => {
    setStats((prev) => {
      if (!guestId) return prev;
      const next: GameStats = {
        ...prev,
        totalGames: prev.totalGames + 1,
        losses: prev.losses + 1,
        currentWinStreak: 0,
      };
      writeStats(guestId, next);
      return next;
    });
  }, [guestId]);

  const recordDraw = useCallback(() => {
    setStats((prev) => {
      if (!guestId) return prev;
      const next: GameStats = {
        ...prev,
        totalGames: prev.totalGames + 1,
        draws: prev.draws + 1,
      };
      writeStats(guestId, next);
      return next;
    });
  }, [guestId]);

  const refresh = useCallback(() => {
    if (!guestId) return;
    setStats(readStats(guestId));
  }, [guestId]);

  return { stats, recordWin, recordLoss, recordDraw, refresh };
}
