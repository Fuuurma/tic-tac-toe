import { useState } from "react";
import { TURN_DURATION_MS, GameModes } from "@/game/constants";
import type { GameState } from "@/game/logic";
import type { GameStats } from "@/hooks/useGameStats";
import { Button } from "@/components/ui/button";
import { Confirm } from "./confirm";
import { cn } from "@/lib/utils";
import { LogOut, RotateCcw } from "lucide-react";

interface PlayersPanelProps {
  gameState: GameState;
  message: string;
  stats?: GameStats;
  onNewGame: () => void;
  onExit: () => void;
}

const formatTime = (ms: number | undefined): number => {
  if (ms === undefined) return 0;
  return Math.max(0, Math.ceil(ms / 1000));
};

const getTimerColor = (seconds: number): string => {
  if (seconds <= 3) return "text-red-500";
  if (seconds <= 6) return "text-amber-500";
  return "text-emerald-500";
};

const getProgressColor = (seconds: number): string => {
  if (seconds <= 3) return "from-red-500 to-red-400";
  if (seconds <= 6) return "from-amber-500 to-amber-400";
  return "from-emerald-500 to-emerald-400";
};

const getGameModeLabel = (mode: string): string => {
  if (mode === GameModes.VS_COMPUTER) return "VS Computer";
  if (mode === GameModes.VS_FRIEND) return "VS Friend";
  if (mode === GameModes.ONLINE) return "Online";
  return mode.replace("_", " ");
};

export function PlayersPanel({
  gameState,
  message,
  stats,
  onNewGame,
  onExit,
}: PlayersPanelProps) {
  const [showExit, setShowExit] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);

  const seconds = formatTime(gameState.turnTimeRemaining);
  const isActive =
    gameState.gameStatus === "ACTIVE" && gameState.winner === null;
  const progress = isActive
    ? Math.max(0, ((gameState.turnTimeRemaining ?? 0) / TURN_DURATION_MS) * 100)
    : 0;

  const activePlayer = gameState.players[gameState.currentPlayer];
  const isAITurn = activePlayer.type === "COMPUTER";
  const activeLabel = isAITurn
    ? `${activePlayer.username || "AI"} thinking`
    : `${activePlayer.username || "Player"}'s turn`;

  return (
    <div className="w-full rounded-lg border bg-card/80 p-2 shadow-lg backdrop-blur sm:rounded-xl sm:p-3">
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
            <span>{getGameModeLabel(gameState.gameMode)}</span>
            {stats && stats.totalGames > 0 && (
              <span
                role="status"
                aria-label={`Record: ${stats.wins} wins, ${stats.losses} losses, ${stats.draws} draws`}
                className="font-medium normal-case tracking-normal text-muted-foreground"
              >
                <span className="text-emerald-600 dark:text-emerald-400">{stats.wins}W</span>
                <span className="mx-0.5 text-muted-foreground/50">·</span>
                <span className="text-red-500">{stats.losses}L</span>
                <span className="mx-0.5 text-muted-foreground/50">·</span>
                <span>{stats.draws}D</span>
                {stats.currentWinStreak > 1 && (
                  <span className="ml-1 text-amber-500">· 🔥{stats.currentWinStreak}</span>
                )}
              </span>
            )}
          </div>
          {isActive && (
            <div
              role="status"
              className={cn(
                "mt-0.5 truncate text-xs sm:text-sm",
                message && !message.endsWith("'s turn.")
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
                getTimerColor(seconds),
              )}
            >
              {message || activeLabel}
            </div>
          )}
        </div>
        <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewGame(true)}
              aria-label="Start a new game"
              className="h-7 w-7 p-0 sm:h-8 sm:w-8"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExit(true)}
              aria-label="Exit game"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive sm:h-8 sm:w-8"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
      </div>

      {isActive && (
        <div className="flex items-center gap-2">
          <div
            role="timer"
            className={cn(
              "flex h-7 min-w-[2rem] items-center justify-center rounded-md px-2 font-mono text-sm font-bold tabular-nums sm:h-8 sm:text-base",
              getTimerColor(seconds),
              seconds <= 3 && seconds > 0 && "animate-timer-pulse",
            )}
            aria-label={`Time remaining: ${seconds} seconds`}
          >
            {seconds}s
          </div>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-300 ease-out",
                getProgressColor(seconds),
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {!isActive && gameState.winner && (
        <div className="flex flex-col gap-1 text-center">
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {gameState.players[gameState.winner].username || "Player"} wins!
          </div>
          {message && <div role="status" className="text-xs text-muted-foreground">{message}</div>}
        </div>
      )}

      {!isActive && !gameState.winner && message && (
        <div role="status" className="text-center text-sm font-semibold text-muted-foreground">
          {message}
        </div>
      )}

      {!isActive && !gameState.winner && !message && gameState.moveCount > 0 && (
        <div className="text-center text-sm font-semibold text-muted-foreground">
          It's a draw.
        </div>
      )}

      <Confirm
        isOpen={showExit}
        title="Exit game"
        description="Are you sure? Current progress will be lost."
        confirmText="Exit"
        destructive
        onConfirm={() => {
          setShowExit(false);
          onExit();
        }}
        onCancel={() => setShowExit(false)}
      />
      <Confirm
        isOpen={showNewGame}
        title={isActive ? "Start a new game" : "Play again"}
        description={isActive ? "Restart with the same players and settings?" : "Play again with the same players and settings?"}
        confirmText={isActive ? "Restart" : "Play again"}
        onConfirm={() => {
          setShowNewGame(false);
          onNewGame();
        }}
        onCancel={() => setShowNewGame(false)}
      />
    </div>
  );
}
