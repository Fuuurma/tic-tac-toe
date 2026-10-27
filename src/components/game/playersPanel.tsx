import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  COLOR_BG_CLASSES,
  COLOR_RGB,
  TURN_DURATION_MS,
  type AI_Difficulty as AI_DifficultyType,
  GameMode,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  COLOR_MARK_TEXT,
  COPY_FLASH_MS,
} from "@/game/constants";
import type { GameState } from "@/game/logic";
import type { GameStats } from "@/hooks/useGameStats";
import { Button } from "@/components/ui/button";
import { GameMark } from "@/components/lobby/gameMark";
import { Confirm } from "./confirm";
import { RecordBreakdown } from "./recordBreakdown";
import { SymbolShapeRenderer } from "./symbolShapeRenderer";
import { cn } from "@/lib/utils";
import { getDifficultyLabel, getModeLabel, t, useStrings } from "@/i18n/language";
import { Check as CheckIcon, Copy as CopyIcon } from "lucide";
import { Crown, Flame, LogOut, Pencil, RotateCcw, Settings2 } from "lucide-react";
import { MorphIcon } from "morphicons/react";
import { ThinkingOrb } from "thinking-orbs";

interface PlayersPanelProps {
  gameState: GameState;
  message: string;
  stats?: GameStats;
  gameMode?: GameMode;
  aiDifficulty?: AI_DifficultyType;
  roomCode?: string;
  onNewGame?: () => void;
  onExit: () => void;
  /** Opens the one settings surface. Omitted by surfaces with no settings
   *  context of their own (the play-while-you-wait card), which then renders
   *  no gear rather than a dead control. */
  onOpenSettings?: () => void;
  /** Edits the player's own identity. Separate from settings: one is "how the
   *  app behaves", the other is "who is playing". Omitted for an online guest,
   *  whose symbol the host assigns. */
  onEditIdentity?: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
  onCancelRematch?: () => void;
  onRequestRematch?: () => void;
  onPauseChange?: (paused: boolean) => void;
  /**
   * True while a mid-game overlay freezes the clock. The countdown ring is a
   * CSS animation, so it kept draining while the numeric timer stood still —
   * the two disagreed for the rest of the turn and the ring read as though
   * the player were burning time they were not.
   */
  paused?: boolean;
}

const formatTime = (ms: number | undefined): number => {
  if (ms === undefined) return 0;
  return Math.max(0, Math.ceil(ms / 1000));
};

const getTimerColor = (seconds: number): string => {
  if (seconds <= 3) return "text-red-500";
  return "text-emerald-500";
};

const getGameModeLabel = (mode: string): string => {
  if (mode === GameModes.VS_COMPUTER) return getModeLabel(GameModes.VS_COMPUTER);
  if (mode === GameModes.VS_FRIEND) return getModeLabel(GameModes.VS_FRIEND);
  if (mode === GameModes.ONLINE) return getModeLabel(GameModes.ONLINE);
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

/** HUD actions: 44px icon squares on desktop; on phones, equal-width
 *  buttons in the bottom bar. While the game runs the icon alone carries
 *  the action (bigger, no words); the words return when the game ends.
 *  The label is visual only either way, the aria-label stays the name. */
const HUD_ACTION =
  "size-11 p-0 text-muted-foreground max-sm:h-14 max-sm:w-auto max-sm:min-w-0 max-sm:flex-1 max-sm:flex-col max-sm:gap-1";
const HUD_ACTION_LABEL = "text-sm font-medium leading-none sm:hidden";

export function PlayersPanel({
  gameState,
  message,
  stats,
  gameMode,
  aiDifficulty,
  roomCode,
  onNewGame,
  onExit,
  onOpenSettings,
  onEditIdentity,
  onAcceptRematch,
  onDeclineRematch,
  onCancelRematch,
  onRequestRematch,
  onPauseChange,
  paused,
}: PlayersPanelProps) {
  // Stored flags + derived read: a fresh game (moveCount 0) must not
  // re-open a confirm stored from the previous game. Resetting via effect
  // trips react-hooks/set-state-in-effect; deriving keeps the reset exact.
  const [showExitStored, setShowExit] = useState(false);
  const [showNewGameStored, setShowNewGame] = useState(false);
  const confirmPauseRef = useRef(false);
  const freshGame = gameState.moveCount === 0;
  const showExit = showExitStored && !freshGame;
  const showNewGame = showNewGameStored && !freshGame;
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyError(false);
      setCopiedRoom(true);
      window.setTimeout(() => setCopiedRoom(false), COPY_FLASH_MS);
    } catch {
      // The other two copy affordances on this screen both say when the
      // clipboard refused; this one used to fail silently, leaving the reader
      // pressing a button that appeared to work.
      setCopyError(true);
    }
  };

  // Subscribes so a language switch re-renders the HUD.
  useStrings();
  const seconds = formatTime(gameState.turnTimeRemaining);
  const isActive =
    gameState.gameStatus === GameStatus.ACTIVE && gameState.winner === null;
  /** The colour of whoever won, or null for a draw: the win surfaces (line,
   *  card, restart tint) all key on it so none of them can wear a colour that
   *  belongs to nobody. */
  const winnerColor = gameState.winner ? gameState.players[gameState.winner].color : null;
  const isGameOver =
    gameState.gameStatus !== GameStatus.ACTIVE || gameState.winner !== null;
  const isOnline = gameMode === GameModes.ONLINE;
  const exitLabel = isOnline ? t("game.leave") : t("game.exit");

  // Confirmations belong to the active round. A host terminal frame can make
  // Confirm close through isActive without calling onCancel, so discard both
  // stored prompts as the round ends or a fresh round starts. Adjusting this
  // state during render avoids the set-state-in-effect cascading render.
  const [previousLifecycle, setPreviousLifecycle] = useState({
    isActive,
    freshGame,
  });
  if (
    previousLifecycle.isActive !== isActive ||
    previousLifecycle.freshGame !== freshGame
  ) {
    setPreviousLifecycle({ isActive, freshGame });
    if (!isActive || freshGame) {
      setShowExit(false);
      setShowNewGame(false);
    }
  }

  // The panel owns only the pause caused by these confirmation sheets. When
  // round state invalidates one, release that pause in the parent as well.
  const onPauseChangeRef = useRef(onPauseChange);
  // The latest handler is assigned in the commit phase, not in the render body
  // (the same fix as board.tsx / F760): a parent that passes a fresh inline
  // callback every render must not make this effect re-run, or its cleanup
  // releases the pause the confirmation is holding.
  useEffect(() => {
    onPauseChangeRef.current = onPauseChange;
  }, [onPauseChange]);

  useEffect(() => {
    if ((!isActive || freshGame) && confirmPauseRef.current) {
      confirmPauseRef.current = false;
      onPauseChangeRef.current?.(false);
    }

    // The transport-error view can unmount this panel while the room stays mounted.
    return () => {
      if (confirmPauseRef.current) {
        confirmPauseRef.current = false;
        onPauseChangeRef.current?.(false);
      }
    };
  }, [freshGame, isActive]);

  const activePlayer = gameState.players[gameState.currentPlayer];
  const isAITurn = activePlayer.type === PlayerTypes.COMPUTER;
  const activeLabel = isAITurn
    ? t("game.thinking", { name: activePlayer.username || t("settings.aiFallback") })
    : t("game.turn", { name: activePlayer.username || t("game.playerFallback") });

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

  // A fresh game (moveCount 0) has nothing to confirm either, and `showNewGame`
  // / `showExit` deliberately suppress the dialog for it. Arming the pause here
  // would then strand the game: only the dialog disarms it, so the timer stays
  // frozen and the board stays disabled with no visible pause state.
  const handleNewGameClick = () => {
    if (!onNewGame) return;
    if (isGameOver || freshGame) {
      onNewGame();
      return;
    }
    setShowNewGame(true);
    confirmPauseRef.current = true;
    onPauseChange?.(true);
  };

  const handleExitClick = () => {
    if (isGameOver || freshGame) {
      onExit();
      return;
    }
    setShowExit(true);
    confirmPauseRef.current = true;
    onPauseChange?.(true);
  };

  return (
    <div
      ref={panelRef}
      className={cn(
        // Phones: `contents` dissolves the HUD box so its rows join the game
        // column and order around the board: status on top, players, the
        // board, then the actions in a thumb-reach bar at the bottom edge.
        //
        // z-20: the record breakdown hangs off this box and runs taller than
        // it. While a game is live the HUD is not a stacking context, so the
        // panel's own z-30 beat the board; once it ends the root takes `glass`
        // (isolation: isolate), the whole HUD paints in DOM order, and the
        // board, which comes later, cut off the panel's last rows. Stating the
        // layer here keeps the HUD above the board in both states.
        "relative z-20 w-full px-4 pt-3 pb-4 max-sm:contents sm:rounded-2xl sm:px-5 sm:py-5",
        !isActive && "glass",
      )}
    >
      {isActive && (
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
                key={`${gameState.moveCount}-${gameState.currentPlayer}`}
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
                    // Freeze the ring with the clock. `animation-play-state`
                    // holds the current offset instead of restarting the
                    // animation, so the ring resumes exactly where the
                    // number left off.
                    animationPlayState: paused ? "paused" : "running",
                  } as React.CSSProperties
                }
              />
            </svg>
          )}
          <div
            role="timer"
            aria-label={t("game.timer", { seconds })}
            className={cn(
              "pointer-events-none absolute left-1/2 top-3 z-[3] flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center",
              // On phones the clock is an inline chip above the header, not a
              // disc on the ring, so it does not cover the status line.
              "max-sm:right-4 max-sm:left-auto max-sm:top-[max(0.75rem,var(--inset-top))] max-sm:h-11 max-sm:w-14 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-lg max-sm:glass-cell",
              getTimerColor(seconds),
            )}
          >
            <span className="font-mono text-base font-bold tabular-nums">
              {seconds}
            </span>
          </div>
        </>
      )}
      {/* z-20, above the z-10 player-card grid: the record breakdown
          popover is anchored in this header and would otherwise be painted
          under the cards, which come later in the DOM at the same level. */}
      <div className="relative z-20 mb-3 flex items-center justify-between gap-2 max-sm:contents sm:mb-3.5">
        <div
          className={cn(
            "min-w-0 flex-1 max-sm:order-1 max-sm:flex-none max-sm:px-4 max-sm:pt-[max(0.75rem,var(--inset-top))]",
            // Phones: the mark, then the title over the record, the whole
            // block as tall as the 44px clock beside it so the three line up
            // and the cards below start a full gap clear of the clock.
            "max-sm:grid max-sm:grid-cols-[auto_1fr] max-sm:items-center",
            isActive && "sm:max-w-[calc(50%-2rem)] max-sm:pr-22",
          )}
        >
          <GameMark size="sm" className="sm:hidden max-sm:col-start-1 max-sm:row-span-2 max-sm:mr-3" />
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted-foreground max-sm:col-start-2 max-sm:gap-y-0 max-sm:text-base max-sm:leading-5">
            <span className="max-sm:basis-full max-sm:text-xl max-sm:font-bold max-sm:leading-6 max-sm:tracking-tight max-sm:text-foreground">
              {getGameModeLabel(gameMode ?? gameState.gameMode)}
            </span>
            {roomCode && (
              <button
                type="button"
                onClick={copyRoomCode}
                className="glass-cell inline-flex max-w-40 min-h-11 min-w-0 items-center gap-1 rounded-md px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-foreground max-sm:text-xs transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title={t("game.copyRoomTitle", { code: roomCode })}
                aria-label={t("game.copyRoomAria", { code: roomCode })}
              >
                <span className="sr-only">{t("game.roomCodeSr")}</span>
                <span className="truncate">{roomCode}</span>
                {copiedRoom && (
                  <span role="status" aria-live="polite" className="sr-only">
                    {t("game.copied")}
                  </span>
                )}
                {copyError && (
                  <span role="status" aria-live="polite" className="text-[10px] font-normal normal-case tracking-normal text-destructive">
                    {t("online.copyFail")}
                  </span>
                )}
                <MorphIcon
                  icon={copiedRoom ? CheckIcon : CopyIcon}
                  className={`size-3 shrink-0 ${copiedRoom ? "text-emerald-500" : "text-muted-foreground"}`}
                  aria-hidden="true"
                />
              </button>
            )}
            {stats && stats.totalGames > 0 && (
              // The chip and its breakdown share one hover target: the
              // numbers are what someone points at, so they must open it too.
              <RecordBreakdown
                stats={stats}
                gameMode={gameMode ?? gameState.gameMode}
              >
                <span
                  role="status"
                  aria-label={t("game.record", { wins: stats.wins, losses: stats.losses })}
                  className="font-medium normal-case tracking-normal text-muted-foreground"
                >
                  <span className="text-emerald-600 dark:text-emerald-400">{t("game.wins", { count: stats.wins })}</span>
                  <span className="mx-0.5 text-muted-foreground/50">·</span>
                  <span className="text-red-500">{t("game.losses", { count: stats.losses })}</span>
                  {stats.currentWinStreak > 1 && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-amber-500">
                      · <Flame className="size-3" aria-hidden="true" />
                      {stats.currentWinStreak}
                    </span>
                  )}
                </span>
              </RecordBreakdown>
            )}
          </div>
          {isActive && (
            <div
              role="status"
              className={cn(
                // A peer-supplied notice runs up to PEER_MAX_ERROR_LENGTH (200 chars).
                // `truncate` cut it to a couple of glyphs on a 320px phone, so
                // the player saw what looked like an empty status line. Two
                // clamped lines keep the HUD compact and still carry the start
                // of the message; the full text is announced by the status role.
                "mt-1 line-clamp-2 text-xs max-sm:col-start-2 sm:text-sm",
                // An explicit status message is alert-worthy; the default
                // turn label is not. Key off message presence, not copy.
                message
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
                // Phones: the highlighted player card already says whose
                // turn it is, so the default label is screen-reader-only.
                // An explicit message always stays visible.
                !message && "max-sm:sr-only max-sm:mt-0",
              )}
            >
              {message || activeLabel}
            </div>
          )}
        </div>
        <div
          role="toolbar"
          aria-label={t("game.actions")}
          className="flex shrink-0 justify-end gap-1.5 max-sm:order-9 max-sm:mt-auto max-sm:justify-stretch max-sm:gap-2 max-sm:px-4 max-sm:pt-3 max-sm:pb-[max(0.75rem,var(--inset-bottom))]"
        >
          {onOpenSettings && (
            <Button
              variant="glass"
              size="sm"
              onClick={onOpenSettings}
              aria-label={t("settings.open")}
              className={HUD_ACTION}
            >
              <Settings2
                className={cn("size-4", isGameOver ? "max-sm:size-5" : "max-sm:size-7")}
                aria-hidden="true"
              />
              {isGameOver && <span className={HUD_ACTION_LABEL}>{t("settings.open")}</span>}
            </Button>
          )}
          {onEditIdentity && (
            <Button
              variant="glass"
              size="sm"
              onClick={onEditIdentity}
              aria-label={t("game.editSettings")}
              className={HUD_ACTION}
            >
              <Pencil
                className={cn("size-4", isGameOver ? "max-sm:size-5" : "max-sm:size-7")}
                aria-hidden="true"
              />
              {isGameOver && <span className={HUD_ACTION_LABEL}>{t("game.edit")}</span>}
            </Button>
          )}
          {onNewGame && (
            <Button
              variant="glass"
              size="sm"
              onClick={handleNewGameClick}
              aria-label={isGameOver ? t("game.again") : t("game.restartTitle")}
              className={cn(HUD_ACTION, isGameOver && "max-sm:font-semibold max-sm:text-foreground")}
              // Game over: the restart is the next thing a phone player wants,
              // so it takes the win tint in the bar — in the WINNER's colour,
              // like the line and the card. A fixed emerald was a third
              // "someone won" green that belonged to nobody; a draw stays neutral.
              style={
                winnerColor
                  ? ({ "--glass-tint": COLOR_RGB[winnerColor], "--glass-alpha": "0.22" } as React.CSSProperties)
                  : undefined
              }
            >
              <RotateCcw
                className={cn("size-4", isGameOver ? "max-sm:size-5" : "max-sm:size-7")}
                aria-hidden="true"
              />
              {isGameOver && <span className={HUD_ACTION_LABEL}>{t("game.again")}</span>}
            </Button>
          )}
          <Button
            variant="glass"
            size="sm"
            onClick={handleExitClick}
            aria-label={exitLabel}
            className={cn(HUD_ACTION, "hover:text-red-500")}
            style={{ "--glass-sweep-color": "239 68 68" } as React.CSSProperties}
          >
            <LogOut
              className={cn("size-4", isGameOver ? "max-sm:size-5" : "max-sm:size-7")}
              aria-hidden="true"
            />
            {isGameOver && <span className={HUD_ACTION_LABEL}>{isOnline ? t("game.leaveConfirm") : t("game.exitConfirm")}</span>}
          </Button>
        </div>
      </div>

      <div className="no-touch-select relative z-10 grid grid-cols-2 gap-2.5 max-sm:order-2 max-sm:px-4 max-sm:pt-3">
        <PlayerCard
          playerSymbol={PlayerSymbol.X}
          player={gameState.players[PlayerSymbol.X]}
          isCurrent={gameState.currentPlayer === PlayerSymbol.X && isActive}
          isWinner={gameState.winner === PlayerSymbol.X}
          isAITurn={isAITurn && gameState.currentPlayer === PlayerSymbol.X && isActive}
          aiDifficultyLabel={
            gameState.players[PlayerSymbol.X].type === PlayerTypes.COMPUTER && aiDifficulty
              ? getDifficultyLabel(aiDifficulty)
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
              ? getDifficultyLabel(aiDifficulty)
              : undefined
          }
        />
      </div>

      {!isActive && gameState.winner && (
        <div className="relative z-10 mt-3 max-sm:order-3 max-sm:mt-0 max-sm:px-4 max-sm:pt-3">
          <GameEndActions
            headline={t("game.winsHeadline", { name: gameState.players[gameState.winner].username || t("game.playerFallback") })}
            message={message}
            onAcceptRematch={onAcceptRematch}
            onDeclineRematch={onDeclineRematch}
            onCancelRematch={onCancelRematch}
            onRequestRematch={onRequestRematch}
          />
        </div>
      )}

      <Confirm
        isOpen={showExit && isActive}
        title={exitLabel}
        description={isOnline ? t("game.exitOnlineDesc") : t("game.exitLocalDesc")}
        confirmText={isOnline ? t("game.leaveConfirm") : t("game.exitConfirm")}
        destructive
        playerColor={humanColor}
        onConfirm={() => {
          setShowExit(false);
          confirmPauseRef.current = false;
          onPauseChange?.(false);
          onExit();
        }}
        onCancel={() => {
          setShowExit(false);
          confirmPauseRef.current = false;
          onPauseChange?.(false);
        }}
      />
      <Confirm
        isOpen={showNewGame && isActive}
        title={isActive ? t("game.restartTitle") : t("game.againTitle")}
        confirmText={isActive ? t("game.restart") : t("game.again")}
        playerColor={humanColor}
        onConfirm={() => {
          setShowNewGame(false);
          confirmPauseRef.current = false;
          onPauseChange?.(false);
          onNewGame?.();
        }}
        onCancel={() => {
          setShowNewGame(false);
          confirmPauseRef.current = false;
          onPauseChange?.(false);
        }}
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
  // Own subscription: memo would otherwise hold the old language.
  useStrings();
  const displayName = player.username || t("game.cardPlayer", { symbol: playerSymbol });
  return (
    <div
      role="group"
      aria-label={`${displayName}, ${playerSymbol}${aiDifficultyLabel ? `, ${aiDifficultyLabel}` : ""}${isCurrent ? t("game.currentTurn") : ""}${isWinner ? `, ${t("game.winner")}` : ""}`}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors sm:px-3.5 sm:py-3",
        isCurrent && "border-[rgb(var(--player-color)/0.4)] bg-[rgb(var(--player-color)/0.1)] shadow-sm",
        // The winner is marked in the colour they already own everywhere else
        // on screen. The crown, not the hue, is what says "won" (status is
        // never colour-alone); it arrives with the board's flourish.
        isWinner &&
          "border-[rgb(var(--player-color)/0.55)] bg-[rgb(var(--player-color)/0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]",
        !isCurrent && !isWinner && "glass-cell border-white/30 dark:border-white/10",
      )}
      style={{ "--player-color": COLOR_RGB[player.color] } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
          COLOR_MARK_TEXT[player.color],
          COLOR_BG_CLASSES[player.color],
        )}
      >
        <SymbolShapeRenderer shape={player.shape} strokeWidth={10} className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight max-sm:line-clamp-2 max-sm:break-words sm:truncate landscape-short:line-clamp-2 landscape-short:whitespace-normal landscape-short:break-words">
          {displayName}
          {aiDifficultyLabel && (
            // Stacked under the name on phones: "AI (Normal)" is wider than the
            // room a half-width card leaves at 360px, and wrapped as "(Normal" / ")".
            <span className="ml-1 text-[11px] font-medium text-muted-foreground max-sm:ml-0 max-sm:block max-sm:text-xs landscape-short:ml-0 landscape-short:block">
              ({aiDifficultyLabel})
            </span>
          )}
        </div>
      </div>
      {isWinner && (
        <Crown
          className="size-4 shrink-0 animate-crown-pop text-[rgb(var(--player-color))]"
          aria-hidden="true"
        />
      )}
      {isCurrent && !isWinner && (
        <ThinkingOrb
          state={isAITurn ? "solving" : "listening"}
          size={20}
          aria-label={isAITurn ? t("game.aiThinking") : t("game.waitingMove")}
          className="shrink-0"
        />
      )}
    </div>
  );
});

interface GameEndActionsProps {
  headline: string | null;
  message: string | null;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
  onCancelRematch?: () => void;
  onRequestRematch?: () => void;
}

function GameEndActions({
  headline,
  message,
  onAcceptRematch,
  onDeclineRematch,
  onCancelRematch,
  onRequestRematch,
}: GameEndActionsProps) {
  return (
    <div className="flex flex-col gap-1.5 text-center">
      {headline && (
        // The board and the winner's crown already say who won, in that
        // player's own colour. "X wins!" over the top repeated it in words (and
        // in a colour that belonged to nobody), so it is announced rather than
        // printed: assistive technology still gets the sentence.
        <div role="status" className="sr-only">
          {headline}
        </div>
      )}
      {message && (
        <div role="status" className="text-xs text-muted-foreground">
          {message}
        </div>
      )}
      {(onAcceptRematch ||
        onDeclineRematch ||
        onCancelRematch ||
        onRequestRematch) && (
        <div className="mx-auto mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {onCancelRematch && (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={onCancelRematch}
            >
              {t("game.cancelRematch")}
            </Button>
          )}
          {onDeclineRematch && (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={onDeclineRematch}
            >
              {t("game.declineRematch")}
            </Button>
          )}
          {onRequestRematch && (
            <Button
              type="button"
              size="sm"
              onClick={onRequestRematch}
            >
              {t("game.rematch")}
            </Button>
          )}
          {onAcceptRematch && (
            <Button
              type="button"
              size="sm"
              onClick={onAcceptRematch}
            >
              {t("game.acceptRematch")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
