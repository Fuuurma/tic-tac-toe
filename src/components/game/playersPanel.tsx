import { memo, useLayoutEffect, useRef, useState } from "react";
import {
  COLOR_BG_CLASSES,
  COLOR_RGB,
  TURN_DURATION_MS,
  AI_Difficulty,
  type AI_Difficulty as AI_DifficultyType,
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
import { CircleHelp, Flame, LogOut, Pencil, RotateCcw } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";

interface PlayersPanelProps {
  gameState: GameState;
  message: string;
  stats?: GameStats;
  gameMode?: GameMode;
  aiDifficulty?: AI_DifficultyType;
  onNewGame: () => void;
  onExit: () => void;
  onHelp?: () => void;
  onEditSettings?: () => void;
}

const formatTime = (ms: number | undefined): number => {
  if (ms === undefined) return 0;
  return Math.max(0, Math.ceil(ms / 1000));
};

const AI_DIFFICULTY_LABEL: Record<AI_DifficultyType, string> = {
  [AI_Difficulty.EASY]: "easy",
  [AI_Difficulty.NORMAL]: "medium",
  [AI_Difficulty.HARD]: "hard",
};

const getTimerColor = (seconds: number): string => {
  if (seconds <= 3) return "text-red-500";
  if (seconds <= 6) return "text-amber-500";
  return "text-emerald-500";
};

const getGameModeLabel = (mode: string): string => {
  if (mode === GameModes.VS_COMPUTER) return "VS Computer";
  if (mode === GameModes.VS_FRIEND) return "VS Friend";
  if (mode === GameModes.ONLINE) return "Online";
  return mode.replace("_", " ");
};

const getTimerBorderPath = (width: number, height: number): string => {
  const inset = 1.5;
  const bumpRadius = 24;
  const baseline = 24;
  const cornerRadius = Math.min(30, Math.max(18, width / 7));
  const left = inset;
  const right = width - inset;
  const bottom = height - inset;
  const center = width / 2;

  return [
    `M ${center} ${baseline - bumpRadius}`,
    `A ${bumpRadius} ${bumpRadius} 0 0 1 ${center + bumpRadius} ${baseline}`,
    `H ${right - cornerRadius}`,
    `A ${cornerRadius} ${cornerRadius} 0 0 1 ${right} ${baseline + cornerRadius}`,
    `V ${bottom - cornerRadius}`,
    `A ${cornerRadius} ${cornerRadius} 0 0 1 ${right - cornerRadius} ${bottom}`,
    `H ${left + cornerRadius}`,
    `A ${cornerRadius} ${cornerRadius} 0 0 1 ${left} ${bottom - cornerRadius}`,
    `V ${baseline + cornerRadius}`,
    `A ${cornerRadius} ${cornerRadius} 0 0 1 ${left + cornerRadius} ${baseline}`,
    `H ${center - bumpRadius}`,
    `A ${bumpRadius} ${bumpRadius} 0 0 1 ${center} ${baseline - bumpRadius}`,
  ].join(" ");
};

export function PlayersPanel({
  gameState,
  message,
  stats,
  gameMode,
  aiDifficulty,
  onNewGame,
  onExit,
  onHelp,
  onEditSettings,
}: PlayersPanelProps) {
  const [showExit, setShowExit] = useState(false);
  const [showNewGame, setShowNewGame] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

  const seconds = formatTime(gameState.turnTimeRemaining);
  const isActive =
    gameState.gameStatus === GameStatus.ACTIVE && gameState.winner === null;
  const isGameOver =
    gameState.gameStatus !== GameStatus.ACTIVE || gameState.winner !== null;
  const progress = isActive
    ? Math.max(
        0,
        Math.min(
          100,
          ((gameState.turnTimeRemaining ?? 0) / TURN_DURATION_MS) * 100,
        ),
      )
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

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const updateSize = () => {
      const { width, height } = panel.getBoundingClientRect();
      setPanelSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const handleNewGameClick = () => {
    if (isGameOver) {
      onNewGame();
      return;
    }
    setShowNewGame(true);
  };

  const handleExitClick = () => {
    if (isGameOver) {
      onExit();
      return;
    }
    setShowExit(true);
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative w-full rounded-2xl px-4 py-4 sm:px-5 sm:py-5",
        !isActive && "glass",
      )}
    >
      {isActive && (
        <>
          <div
            aria-hidden="true"
            className="glass pointer-events-none !absolute inset-x-0 -top-3 bottom-0 !rounded-[30px] !border-0"
            style={{
              WebkitMaskImage:
                "radial-gradient(circle 24px at 50% 24px, black 99%, transparent 100%), linear-gradient(black 0 0)",
              maskImage:
                "radial-gradient(circle 24px at 50% 24px, black 99%, transparent 100%), linear-gradient(black 0 0)",
              WebkitMaskSize: "100% 48px, 100% calc(100% - 24px)",
              maskSize: "100% 48px, 100% calc(100% - 24px)",
              WebkitMaskPosition: "0 0, 0 24px",
              maskPosition: "0 0, 0 24px",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            }}
          />
          {panelSize.width > 0 && panelSize.height > 0 && (
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${panelSize.width} ${panelSize.height + 12}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute -top-3 left-0 z-[2] h-[calc(100%+0.75rem)] w-full overflow-visible text-emerald-500"
            >
              <path
                d={getTimerBorderPath(panelSize.width, panelSize.height + 12)}
                pathLength={100}
                fill="none"
                stroke="rgb(var(--glass-border) / 0.28)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              <path
                key={`${gameState.moveCount}-${gameState.currentPlayer}`}
                d={getTimerBorderPath(panelSize.width, panelSize.height + 12)}
                pathLength={100}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="100 100"
                strokeDashoffset={100 - progress}
                strokeLinecap="butt"
                vectorEffect="non-scaling-stroke"
                className="animate-countdown-border"
                style={
                  {
                    "--timer-duration": `${TURN_DURATION_MS}ms`,
                  } as React.CSSProperties
                }
              />
            </svg>
          )}
          <div
            role="timer"
            aria-label={`Time remaining: ${seconds} seconds`}
            className={cn(
              "pointer-events-none absolute left-1/2 top-3 z-[3] flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center",
              getTimerColor(seconds),
            )}
          >
            <span className="font-mono text-base font-bold tabular-nums">
              {seconds}
            </span>
          </div>
        </>
      )}
      <div className="relative z-10 mb-3 flex items-center justify-between gap-2 sm:mb-3.5">
        <div
          className={cn(
            "min-w-0 flex-1",
            isActive && "max-w-[calc(50%-2rem)]",
          )}
        >
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
              )}
            >
              {message || activeLabel}
            </div>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-1.5">
          <Button
            variant="glass"
            size="sm"
            onClick={onHelp}
            aria-label="How to play"
            className="size-9 p-0 text-muted-foreground sm:size-10"
          >
            <CircleHelp className="size-4" aria-hidden="true" />
          </Button>
          {onEditSettings && (
            <Button
              variant="glass"
              size="sm"
              onClick={onEditSettings}
              aria-label="Edit player and opponent settings"
              className="size-9 p-0 text-muted-foreground sm:size-10"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="glass"
            size="sm"
            onClick={handleNewGameClick}
            aria-label={isGameOver ? "Play again" : "Start a new game"}
            className="size-9 p-0 text-[rgb(var(--player-color))] hover:bg-[rgb(var(--player-color)/0.15)] sm:size-10"
            style={{ "--glass-sweep-color": humanColor } as React.CSSProperties}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="glass"
            size="sm"
            onClick={handleExitClick}
            aria-label={exitLabel}
            className="size-9 p-0 text-white hover:bg-red-500/90 hover:text-black sm:size-10"
            style={{ "--glass-sweep-color": "239 68 68" } as React.CSSProperties}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-2.5">
        <PlayerCard
          playerSymbol={PlayerSymbol.X}
          player={gameState.players[PlayerSymbol.X]}
          isCurrent={gameState.currentPlayer === PlayerSymbol.X && isActive}
          isWinner={gameState.winner === PlayerSymbol.X}
          isAITurn={isAITurn && gameState.currentPlayer === PlayerSymbol.X && isActive}
          aiDifficultyLabel={
            gameState.players[PlayerSymbol.X].type === PlayerTypes.COMPUTER && aiDifficulty
              ? AI_DIFFICULTY_LABEL[aiDifficulty]
              : undefined
          }
        />
        <PlayerCard
          playerSymbol={PlayerSymbol.O}
          player={gameState.players[PlayerSymbol.O]}
          isCurrent={gameState.currentPlayer === PlayerSymbol.O && isActive}
          isWinner={gameState.winner === PlayerSymbol.O}
          isAITurn={isAITurn && gameState.currentPlayer === PlayerSymbol.O && isActive}
          aiDifficultyLabel={
            gameState.players[PlayerSymbol.O].type === PlayerTypes.COMPUTER && aiDifficulty
              ? AI_DIFFICULTY_LABEL[aiDifficulty]
              : undefined
          }
        />
      </div>

      {!isActive && gameState.winner && (
        <div className="relative z-10 mt-3">
          <GameEndActions
            headline={`${gameState.players[gameState.winner].username || "Player"} wins!`}
            message={message}
          />
        </div>
      )}

      <Confirm
        isOpen={showExit && isActive}
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
        isOpen={showNewGame && isActive}
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

const PlayerCard = memo(function PlayerCard({
  playerSymbol,
  player,
  isCurrent,
  isWinner,
  isAITurn,
  aiDifficultyLabel,
}: {
  playerSymbol: PlayerSymbol;
  player: GameState["players"][PlayerSymbol];
  isCurrent: boolean;
  isWinner: boolean;
  isAITurn: boolean;
  aiDifficultyLabel?: string;
}) {
  const displayName = player.username || `Player ${playerSymbol}`;
  return (
    <div
      role="group"
      aria-label={`${displayName}, ${playerSymbol}${aiDifficultyLabel ? `, ${aiDifficultyLabel}` : ""}${isCurrent ? ", current turn" : ""}`}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors sm:px-3.5 sm:py-3",
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
          {displayName}
          {aiDifficultyLabel && (
            <span className="ml-1 text-[11px] font-medium text-muted-foreground">
              ({aiDifficultyLabel})
            </span>
          )}
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
});

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
