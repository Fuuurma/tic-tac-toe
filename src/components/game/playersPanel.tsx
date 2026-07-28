import { useState } from "react";
import {
  COLOR_BG_CLASSES,
  COLOR_RGB,
  TURN_DURATION_MS,
  GameMode,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
} from "@/game/constants";
import type { GameState } from "@/game/logic";
import type { GameStats } from "@/hooks/useGameStats";
import { Button } from "@/components/ui/button";
import { Confirm } from "./confirm";
import { SymbolShapeRenderer } from "./symbolShapeRenderer";
import { cn } from "@/lib/utils";
import { CircleHelp, Flame, LogOut, RotateCcw } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

interface PlayersPanelProps {
  gameState: GameState;
  message: string;
  stats?: GameStats;
  gameMode?: GameMode;
  onNewGame: () => void;
  onExit: () => void;
  onHelp?: () => void;
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
  gameMode,
  onNewGame,
  onExit,
  onHelp,
}: PlayersPanelProps) {
  const [showExit, setShowExit] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);

  const seconds = formatTime(gameState.turnTimeRemaining);
  const isActive =
    gameState.gameStatus === GameStatus.ACTIVE && gameState.winner === null;
  const progress = isActive
    ? Math.max(0, ((gameState.turnTimeRemaining ?? 0) / TURN_DURATION_MS) * 100)
    : 0;
  const isOnline = gameMode === GameModes.ONLINE;
  const exitLabel = isOnline ? "Leave game" : "Exit game";

  const activePlayer = gameState.players[gameState.currentPlayer];
  const isAITurn = activePlayer.type === PlayerTypes.COMPUTER;
  const activeLabel = isAITurn
    ? `${activePlayer.username || "AI"} thinking`
    : `${activePlayer.username || "Player"}'s turn`;

  const humanPlayer = Object.values(gameState.players).find(
    (p) => p.type !== PlayerTypes.COMPUTER,
  );
  const humanColor = humanPlayer ? COLOR_RGB[humanPlayer.color] : "255 255 255";

  return (
    <div className="glass w-full p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>{getGameModeLabel(gameState.gameMode)}</span>
            {stats && stats.totalGames > 0 && (
              <span
                role="status"
                aria-label={`Record: ${stats.wins} wins, ${stats.losses} losses`}
                className="font-medium normal-case tracking-normal text-muted-foreground"
              >
                <span className="text-emerald-600 dark:text-emerald-400">{stats.wins}W</span>
                <span className="mx-0.5 text-muted-foreground/50">·</span>
                <span className="text-red-500">{stats.losses}L</span>
                {stats.currentWinStreak > 1 && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                    · <Flame className="size-3" aria-hidden="true" />
                    {stats.currentWinStreak}
                  </span>
                )}
              </span>
            )}
          </div>
          {isActive && (
            <div
              role="status"
              className={cn(
                "mt-1 truncate text-xs sm:text-sm",
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
        <div className="flex gap-1.5">
          <Button
            variant="glass"
            size="sm"
            onClick={onHelp}
            aria-label="How to play"
            className="size-8 p-0 text-muted-foreground sm:size-9"
          >
            <CircleHelp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowNewGame(true)}
            aria-label="Start a new game"
            className="size-8 p-0 text-[rgb(var(--player-color))] hover:bg-[rgb(var(--player-color)/0.15)] sm:size-9"
            style={{ "--glass-sweep-color": humanColor } as React.CSSProperties}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowExit(true)}
            aria-label={exitLabel}
            className="size-8 p-0 text-red-500 hover:bg-red-500/15 sm:size-9"
            style={{ "--glass-sweep-color": "239 68 68" } as React.CSSProperties}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <PlayerCard
          playerSymbol={PlayerSymbol.X}
          player={gameState.players[PlayerSymbol.X]}
          isCurrent={gameState.currentPlayer === PlayerSymbol.X && isActive}
          isWinner={gameState.winner === PlayerSymbol.X}
          isAITurn={isAITurn && gameState.currentPlayer === PlayerSymbol.X && isActive}
        />
        <PlayerCard
          playerSymbol={PlayerSymbol.O}
          player={gameState.players[PlayerSymbol.O]}
          isCurrent={gameState.currentPlayer === PlayerSymbol.O && isActive}
          isWinner={gameState.winner === PlayerSymbol.O}
          isAITurn={isAITurn && gameState.currentPlayer === PlayerSymbol.O && isActive}
        />
      </div>

      {isActive && (
        <div className="mt-3 flex items-center gap-2.5">
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
          <div
            role="progressbar"
            aria-label="Turn time remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted"
          >
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
        <div className="mt-3">
          <GameEndActions
            headline={`${gameState.players[gameState.winner].username || "Player"} wins!`}
            message={message}
          />
        </div>
      )}

      <Confirm
        isOpen={showExit}
        title={exitLabel}
        description={isOnline ? "Leave the room? Your opponent will be notified." : "Are you sure? Current progress will be lost."}
        confirmText={isOnline ? "Leave" : "Exit"}
        destructive
        playerColor={humanColor}
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
        playerColor={humanColor}
        onConfirm={() => {
          setShowNewGame(false);
          onNewGame();
        }}
        onCancel={() => setShowNewGame(false)}
      />
    </div>
  );
}

function PlayerCard({
  playerSymbol,
  player,
  isCurrent,
  isWinner,
  isAITurn,
}: {
  playerSymbol: PlayerSymbol;
  player: GameState["players"][PlayerSymbol];
  isCurrent: boolean;
  isWinner: boolean;
  isAITurn: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={`${player.username || `Player ${playerSymbol}`}, ${playerSymbol}${isCurrent ? ", current turn" : ""}`}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
        isCurrent && "border-[rgb(var(--player-color)/0.4)] bg-[rgb(var(--player-color)/0.1)] shadow-sm",
        isWinner && "border-emerald-500/40 bg-emerald-500/15",
        !isCurrent && !isWinner && "glass-cell border-white/30 dark:border-white/10",
      )}
      style={{ "--player-color": COLOR_RGB[player.color] } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
          COLOR_BG_CLASSES[player.color],
        )}
      >
        <SymbolShapeRenderer shape={player.shape} strokeWidth={10} className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold sm:text-sm">
          {player.username || `Player ${playerSymbol}`}
        </div>
      </div>
      {isCurrent && !isWinner && (
        <ThinkingOrb
          state={isAITurn ? "solving" : "listening"}
          size={20}
          aria-label={isAITurn ? "AI is thinking" : "Waiting for your move"}
          className="shrink-0"
        />
      )}
    </div>
  );
}

interface GameEndActionsProps {
  headline: string | null;
  message: string | null;
}

function GameEndActions({
  headline,
  message,
}: GameEndActionsProps) {
  return (
    <div className="flex flex-col gap-1 text-center">
      {headline && (
        <div
          role="status"
          className="text-sm font-semibold text-emerald-600 dark:text-emerald-400"
        >
          {headline}
        </div>
      )}
      {message && (
        <div role="status" className="text-xs text-muted-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
