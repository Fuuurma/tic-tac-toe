"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trophy, Target, TrendingDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  currentWinStreak?: number;
  bestWinStreak?: number;
}

const STORAGE_KEY = "tictactoe_game_stats";

const defaultStats: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
};

export const loadStats = (): GameStats => {
  if (typeof window === "undefined") return defaultStats;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as GameStats;
    }
  } catch (e) {
    console.error("Failed to load stats from localStorage:", e);
  }
  return defaultStats;
};

export const saveStats = (stats: GameStats): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to save stats to localStorage:", e);
  }
};

export const recordResult = (
  currentStats: GameStats,
  result: "win" | "loss"
): GameStats => {
  const newStats = {
    ...currentStats,
    totalGames: currentStats.totalGames + 1,
    currentWinStreak: currentStats.currentWinStreak || 0,
    bestWinStreak: currentStats.bestWinStreak || 0,
  };

  switch (result) {
    case "win":
      newStats.wins += 1;
      newStats.currentWinStreak += 1;
      if (newStats.currentWinStreak > newStats.bestWinStreak) {
        newStats.bestWinStreak = newStats.currentWinStreak;
      }
      break;
    case "loss":
      newStats.losses += 1;
      newStats.currentWinStreak = 0;
      break;
  }
  saveStats(newStats);

  // Dispatch a custom event so other components (like sidebar) can update immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("statsUpdated"));
  }

  return newStats;
};

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  className?: string;
}

export const StatItem: React.FC<StatItemProps> = ({ icon, label, value, className }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <div className="flex-shrink-0">{icon}</div>
    <div className="flex flex-col">
      <span className="text-xl md:text-2xl font-bold text-foreground">{value}</span>
      <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
    </div>
  </div>
);

interface StatsPanelProps {
  className?: string;
  compact?: boolean;
  stats?: GameStats;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ className, compact = false, stats: propStats }) => {
  const [stats, setStats] = useState<GameStats>(defaultStats);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshStats = useCallback(() => {
    if (propStats) {
      setStats(propStats);
    } else {
      const loaded = loadStats();
      setStats(loaded);
    }
  }, [propStats]);

  useEffect(() => {
    refreshStats();
    setIsLoaded(true);

    // Listen for updates from other components
    window.addEventListener("statsUpdated", refreshStats);
    return () => window.removeEventListener("statsUpdated", refreshStats);
  }, [refreshStats]);

  if (!isLoaded) {
    return null;
  }

  const winRate = stats.totalGames > 0 
    ? Math.round((stats.wins / stats.totalGames) * 100) 
    : 0;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 sm:gap-4 text-xs sm:text-sm", className)}>
        <div className="flex items-center gap-1">
          <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 flex-shrink-0" />
          <span className="font-semibold">{stats.wins}</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
          <span className="font-semibold">{stats.losses}</span>
        </div>
        {stats.totalGames > 0 && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-primary font-semibold ml-1">{winRate}%</span>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className={cn("w-full shadow-lg", className)}>
      <CardHeader className="pb-1 md:pb-2">
        <CardTitle className="text-xs md:text-sm font-medium flex items-center gap-2">
          <Target className="h-4 w-4" />
          Your Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3 px-3 md:px-6 pb-3 md:pb-6">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <StatItem
            icon={<Trophy className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />}
            label="Wins"
            value={stats.wins}
          />
          <StatItem
            icon={<TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-500" />}
            label="Losses"
            value={stats.losses}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-1 md:gap-2">
          <div className="flex flex-col items-center">
            <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
              Win Rate
            </span>
            <span className="text-sm md:text-lg font-bold text-primary">{winRate}%</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
              Streak
            </span>
            <div className="flex items-center gap-0.5 md:gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-sm md:text-lg font-bold text-green-600">{stats.currentWinStreak || 0}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">
              Total
            </span>
            <span className="text-sm md:text-lg font-bold">{stats.totalGames}</span>
          </div>
        </div>
        <Separator className="hidden md:block" />
        <div className="hidden md:flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              Best Streak
            </span>
            <span className="text-lg font-bold text-amber-600">{stats.bestWinStreak || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsPanel;
