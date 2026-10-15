import {
  TURN_DURATION_MS,
  GameModes,
  type GameMode,
  type PlayerSymbol,
} from "@/game/constants";
import type { GameStats } from "@/hooks/useGameStats";
import { Button } from "@/components/ui/button";
import { RecordBreakdown } from "./recordBreakdown";
import { cn } from "@/lib/utils";
import { Check as CheckIcon, Copy as CopyIcon } from "lucide";
import { CircleHelp, Flame, LogOut, Pencil, RotateCcw } from "lucide-react";
import { MorphIcon } from "morphicons/react";

const HUD_ACTION =
  "size-11 p-0 text-muted-foreground max-sm:h-14 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:flex-col max-sm:gap-1";
const HUD_ACTION_LABEL = "text-sm font-medium leading-none sm:hidden";

interface PlayersPanelHeaderProps {
  panelSize: { width: number; height: number };
  info: {
    gameMode: GameMode;
    roomCode?: string;
    copiedRoom: boolean;
    stats?: GameStats;
    message: string;
    activeLabel: string;
    isActive: boolean;
    isGameOver: boolean;
    seconds: number;
    moveCount: number;
    currentPlayer: PlayerSymbol;
    paused?: boolean;
  };
  actions: {
    copyRoomCode: () => void;
    onHelp?: () => void;
    onEditSettings?: () => void;
    onNewGame?: () => void;
    onExit: () => void;
    exitLabel: string;
  };
}

export function PlayersPanelHeader({ panelSize, info, actions }: PlayersPanelHeaderProps) {
  return (
    <>
      {info.isActive && (
        <TurnTimer
          panelSize={panelSize}
          seconds={info.seconds}
          moveCount={info.moveCount}
          currentPlayer={info.currentPlayer}
          paused={info.paused}
        />
      )}
      <div className="relative z-20 mb-3 flex items-center justify-between gap-2 max-sm:contents sm:mb-3.5">
        <HeaderSummary
          info={info}
          onCopyRoomCode={actions.copyRoomCode}
        />
        <HeaderActions
          gameMode={info.gameMode}
          isGameOver={info.isGameOver}
          actions={actions}
        />
      </div>
    </>
  );
}

function TurnTimer({
  panelSize,
  seconds,
  moveCount,
  currentPlayer,
  paused,
}: {
  panelSize: { width: number; height: number };
  seconds: number;
  moveCount: number;
  currentPlayer: PlayerSymbol;
  paused?: boolean;
}) {
  return (
    <>
      {/* Phones drop the bump-tab ring and mask: the ring pokes above
          the HUD into the status bar, and the number carries the time. */}
      <div
        aria-hidden="true"
        className="glass pointer-events-none !absolute inset-x-0 -top-3 bottom-0 !rounded-2xl !border-0 max-sm:hidden"
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
          className={cn(
            "pointer-events-none absolute -top-3 left-0 z-[2] h-[calc(100%+0.75rem)] w-full overflow-visible max-sm:hidden",
            getTimerColor(seconds),
          )}
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
            key={`${moveCount}-${currentPlayer}`}
            d={getTimerBorderPath(panelSize.width, panelSize.height + 12)}
            pathLength={100}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="100 100"
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
            className="animate-countdown-border"
            style={
              {
                "--timer-duration": `${TURN_DURATION_MS}ms`,
                // Freeze the ring with the clock, then resume where it paused.
                animationPlayState: paused ? "paused" : "running",
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
          // On phones the clock is an inline chip above the header, not a
          // disc on the ring, so it does not cover the status line.
          "max-sm:right-4 max-sm:left-auto max-sm:top-[max(0.75rem,var(--inset-top))] max-sm:h-11 max-sm:w-14 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-lg max-sm:glass-cell",
          getTimerColor(seconds),
        )}
      >
        <span className="font-mono text-base font-bold tabular-nums">{seconds}</span>
      </div>
    </>
  );
}

function HeaderSummary({
  info,
  onCopyRoomCode,
}: {
  info: Pick<PlayersPanelHeaderProps["info"], "gameMode" | "roomCode" | "copiedRoom" | "stats" | "message" | "activeLabel" | "isActive">;
  onCopyRoomCode: () => void;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 max-sm:order-1 max-sm:flex-none max-sm:px-4 max-sm:pt-[max(0.75rem,var(--inset-top))]",
        info.isActive && "sm:max-w-[calc(50%-2rem)] max-sm:pr-22",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground max-sm:text-xs">
        <span>{getGameModeLabel(info.gameMode)}</span>
        {info.roomCode && (
          <button
            type="button"
            onClick={onCopyRoomCode}
            className="glass-cell inline-flex max-w-40 min-h-11 min-w-0 items-center gap-1 rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-foreground max-sm:text-xs transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title={`Room code: ${info.roomCode}, click to copy`}
            aria-label={`Room code ${info.roomCode}, click to copy`}
          >
            <span className="sr-only">Room code </span>
            <span className="truncate">{info.roomCode}</span>
            <MorphIcon
              icon={info.copiedRoom ? CheckIcon : CopyIcon}
              className={`size-3 shrink-0 ${info.copiedRoom ? "text-emerald-500" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
          </button>
        )}
        {info.stats && info.stats.totalGames > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <span
              role="status"
              aria-label={`Record: ${info.stats.wins} wins, ${info.stats.losses} losses`}
              className="font-medium normal-case tracking-normal text-muted-foreground"
            >
              <span className="text-emerald-600 dark:text-emerald-400">{info.stats.wins} wins</span>
              <span className="mx-0.5 text-muted-foreground/50">·</span>
              <span className="text-red-500">{info.stats.losses} losses</span>
              {info.stats.currentWinStreak > 1 && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                  · <Flame className="size-3" aria-hidden="true" />
                  {info.stats.currentWinStreak}
                </span>
              )}
            </span>
            <RecordBreakdown stats={info.stats} gameMode={info.gameMode} />
          </span>
        )}
      </div>
      {info.isActive && (
        <div
          role="status"
          className={cn(
            // Two lines preserve a peer notice on narrow phones; key tone off
            // message presence instead of parsing the displayed copy.
            "mt-1 line-clamp-2 text-xs sm:text-sm",
            info.message
              ? "font-medium text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
          )}
        >
          {info.message || info.activeLabel}
        </div>
      )}
    </div>
  );
}

function HeaderActions({
  gameMode,
  isGameOver,
  actions,
}: {
  gameMode: GameMode;
  isGameOver: boolean;
  actions: PlayersPanelHeaderProps["actions"];
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1.5 max-sm:order-9 max-sm:mt-auto max-sm:justify-stretch max-sm:gap-2 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,var(--inset-bottom))]">
      {actions.onHelp && (
        <Button variant="glass" size="sm" onClick={actions.onHelp} aria-label="Help" className={HUD_ACTION}>
          <CircleHelp className="size-4 max-sm:size-5" aria-hidden="true" />
          <span className={HUD_ACTION_LABEL}>Help</span>
        </Button>
      )}
      {actions.onEditSettings && (
        <Button variant="glass" size="sm" onClick={actions.onEditSettings} aria-label="Edit player settings" className={HUD_ACTION}>
          <Pencil className="size-4 max-sm:size-5" aria-hidden="true" />
          <span className={HUD_ACTION_LABEL}>Edit</span>
        </Button>
      )}
      {actions.onNewGame && (
        <Button
          variant="glass"
          size="sm"
          onClick={actions.onNewGame}
          aria-label={isGameOver ? "Play again" : "Start a new game"}
          className={cn(HUD_ACTION, isGameOver && "max-sm:font-semibold max-sm:text-foreground")}
          style={isGameOver ? ({ "--glass-tint": "16 185 129", "--glass-alpha": "0.22" } as React.CSSProperties) : undefined}
        >
          <RotateCcw className="size-4 max-sm:size-5" aria-hidden="true" />
          <span className={HUD_ACTION_LABEL}>{isGameOver ? "Play again" : "New game"}</span>
        </Button>
      )}
      <Button
        variant="glass"
        size="sm"
        onClick={actions.onExit}
        aria-label={actions.exitLabel}
        className={cn(HUD_ACTION, "hover:text-red-500")}
        style={{ "--glass-sweep-color": "239 68 68" } as React.CSSProperties}
      >
        <LogOut className="size-4 max-sm:size-5" aria-hidden="true" />
        <span className={HUD_ACTION_LABEL}>{gameMode === GameModes.ONLINE ? "Leave" : "Exit"}</span>
      </Button>
    </div>
  );
}

const getTimerColor = (seconds: number): string =>
  seconds <= 3 ? "text-red-500" : "text-emerald-500";

const getGameModeLabel = (mode: string): string => {
  if (mode === GameModes.VS_COMPUTER) return "vs Computer";
  if (mode === GameModes.VS_FRIEND) return "vs Friend";
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
