import { useCallback, useState } from "react";
import { getOrCreateGuestIdentity } from "@/lib/identity";

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

const DEFAULT_STATS: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
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
  try {
    window.localStorage.setItem(storageKey(guestId), JSON.stringify(stats));
  } catch {
    // QuotaExceededError — stats will be lost but game continues
  }
};

export function useGameStats() {
  const [guestId] = useState<string>(() => getOrCreateGuestIdentity().guestId);
  const [stats, setStats] = useState<GameStats>(() => readStats(getOrCreateGuestIdentity().guestId));

  const recordWin = useCallback(() => {
    setStats((prev) => {
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

  return { stats, recordWin, recordLoss };
}
