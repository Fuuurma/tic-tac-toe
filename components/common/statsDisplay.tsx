import React from "react";
import { Trophy, TrendingDown, Zap } from "lucide-react";
import { GameStats } from "../game/statsPanel";
import { cn } from "@/lib/utils";

interface StatsDisplayProps {
  stats: GameStats;
  layout?: "grid" | "list"; // "grid" for sidebar, "list" for panel
  compact?: boolean;
  className?: string;
}

/**
 * Reusable stats display component
 * Shows wins, losses, and win streaks
 * Can be displayed in grid layout (sidebar) or list layout (panel)
 */
export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  stats,
  layout = "grid",
  compact = false,
  className,
}) => {
  const winRate =
    stats.totalGames > 0
      ? Math.round((stats.wins / stats.totalGames) * 100)
      : 0;

  if (layout === "grid") {
    return (
      <div className={cn("grid grid-cols-2 gap-2 text-xs", className)}>
        {/* Wins */}
        <div className="bg-amber-500/10 rounded p-2">
          <div className="text-lg font-bold text-amber-600">{stats.wins}</div>
          <div className="text-[10px] text-muted-foreground">Wins</div>
        </div>

        {/* Losses */}
        <div className="bg-red-500/10 rounded p-2">
          <div className="text-lg font-bold text-red-600">{stats.losses}</div>
          <div className="text-[10px] text-muted-foreground">Losses</div>
        </div>

        {/* Win Rate */}
        <div className="bg-blue-500/10 rounded p-2">
          <div className="text-lg font-bold text-blue-600">{winRate}%</div>
          <div className="text-[10px] text-muted-foreground">Win Rate</div>
        </div>

        {/* Current Win Streak */}
        {(stats.currentWinStreak || 0) > 0 && (
          <div className="col-span-2 bg-green-500/10 rounded p-2">
            <div className="text-lg font-bold text-green-600">
              {stats.currentWinStreak}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Win Streak 🔥
            </div>
          </div>
        )}

        {/* Best Win Streak */}
        {(stats.bestWinStreak || 0) > 0 && (
          <div className="col-span-2 bg-amber-500/10 rounded p-2">
            <div className="text-lg font-bold text-amber-600">
              {stats.bestWinStreak}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Best Streak ⭐
            </div>
          </div>
        )}
      </div>
    );
  }

  // List layout (sidebar)
  return (
    <div className={cn("space-y-1", className)}>
      {/* Wins */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm">Wins</span>
        </div>
        <span className="text-sm font-bold">{stats.wins}</span>
      </div>

      {/* Losses */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <span className="text-sm">Losses</span>
        </div>
        <span className="text-sm font-bold">{stats.losses}</span>
      </div>

      {/* Win Streak */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-accent/50 rounded-md mt-1">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Streak</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-sm font-bold text-green-600">
            {stats.currentWinStreak || 0}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Best: {stats.bestWinStreak || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

StatsDisplay.displayName = "StatsDisplay";
