"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameStats } from "@/components/game/statsPanel";
import { getOrCreateGuestIdentity } from "@/app/utils/identity/gameIdentity";

interface StatsHydratorProps {
  onStatsLoaded: (stats: GameStats) => void;
}

const toGameStats = (stats: {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
}): GameStats => ({
  totalGames: stats.gamesPlayed,
  wins: stats.wins,
  losses: stats.losses,
  currentWinStreak: stats.currentStreak,
  bestWinStreak: stats.bestStreak,
});

export function ConvexStatsHydrator({ onStatsLoaded }: StatsHydratorProps) {
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    setGuestId(getOrCreateGuestIdentity().guestId);
  }, []);

  const durableStats = useQuery(
    api.stats.getMine,
    guestId ? { guestId } : "skip"
  );

  useEffect(() => {
    if (!durableStats) return;
    onStatsLoaded(toGameStats(durableStats));
  }, [durableStats, onStatsLoaded]);

  return null;
}
