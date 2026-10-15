import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  COLOR_BG_CLASSES,
  COLOR_RGB,
  AI_DIFFICULTY_LABELS,
  type AI_Difficulty as AI_DifficultyType,
  GameMode,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  COLOR_MARK_TEXT,
} from "@/game/constants";
import type { GameState } from "@/game/logic";
import type { GameStats } from "@/hooks/useGameStats";
import { Button } from "@/components/ui/button";
import { Confirm } from "./confirm";
import { SymbolShapeRenderer } from "./symbolShapeRenderer";
import { cn } from "@/lib/utils";
import { ThinkingOrb } from "thinking-orbs";
import { PlayersPanelHeader } from "./playersPanelHeader";

interface PlayersPanelProps {
  gameState: GameState;
  message: string;
  stats?: GameStats;
  gameMode?: GameMode;
  aiDifficulty?: AI_DifficultyType;
  roomCode?: string;
  onNewGame?: () => void;
  onExit: () => void;
  onHelp?: () => void;
  onEditSettings?: () => void;
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

export function PlayersPanel({
  gameState,
  message,
  stats,
  gameMode,
  aiDifficulty,
  roomCode,
  onNewGame,
  onExit,
  onHelp,
  onEditSettings,
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
  const onPauseChangeRef = useRef(onPauseChange);
  const freshGame = gameState.moveCount === 0;
  const showExit = showExitStored && !freshGame;
  const showNewGame = showNewGameStored && !freshGame;
  const [copiedRoom, setCopiedRoom] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

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

  const copyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedRoom(true);
      window.setTimeout(() => setCopiedRoom(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const seconds = formatTime(gameState.turnTimeRemaining);
  const isActive =
    gameState.gameStatus === GameStatus.ACTIVE && gameState.winner === null;
  const isGameOver =
    gameState.gameStatus !== GameStatus.ACTIVE || gameState.winner !== null;
  const isOnline = gameMode === GameModes.ONLINE;
  const exitLabel = isOnline ? "Leave game" : "Exit game";

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

  useLayoutEffect(() => {
    onPauseChangeRef.current = onPauseChange;
  }, [onPauseChange]);

  // The panel owns only the pause caused by these confirmation sheets. When
  // round state invalidates one or the panel unmounts, release it upstream.
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
    ? `${activePlayer.username || "AI"} thinking`
    : `${activePlayer.username || "Player"}'s turn`;

  const humanPlayer = Object.values(gameState.players).find(
    (p) => p.type !== PlayerTypes.COMPUTER,
  );
  const humanColor = humanPlayer ? COLOR_RGB[humanPlayer.color] : "255 255 255";

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
        "relative w-full px-4 pt-3 pb-4 max-sm:contents sm:rounded-2xl sm:px-5 sm:py-5",
        !isActive && "glass",
      )}
    >
      <PlayersPanelHeader
        panelSize={panelSize}
        info={{
          gameMode: gameMode ?? gameState.gameMode,
          roomCode,
          copiedRoom,
          stats,
          message,
          activeLabel,
          isActive,
          isGameOver,
          seconds,
          moveCount: gameState.moveCount,
          currentPlayer: gameState.currentPlayer,
          paused,
        }}
        actions={{
          copyRoomCode,
          onHelp,
          onEditSettings,
          onNewGame: onNewGame ? handleNewGameClick : undefined,
          onExit: handleExitClick,
          exitLabel,
        }}
      />

      <PlayerCards
        gameState={gameState}
        isActive={isActive}
        isAITurn={isAITurn}
        aiDifficulty={aiDifficulty}
      />

      {!isActive && gameState.winner && (
        <div className="relative z-10 mt-3 max-sm:order-3 max-sm:mt-0 max-sm:px-4 max-sm:pt-3">
          <GameEndActions
            headline={`${gameState.players[gameState.winner].username || "Player"} wins!`}
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
        description={isOnline ? "Leave the room? Your opponent will be notified." : "Are you sure? Current progress will be lost."}
        confirmText={isOnline ? "Leave" : "Exit"}
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
        title={isActive ? "Start a new game" : "Play again"}
        description={isActive ? "Restart with the same players and settings?" : "Play again with the same players and settings?"}
        confirmText={isActive ? "Restart" : "Play again"}
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

function PlayerCards({
  gameState,
  isActive,
  isAITurn,
  aiDifficulty,
}: {
  gameState: GameState;
  isActive: boolean;
  isAITurn: boolean;
  aiDifficulty?: AI_DifficultyType;
}) {
  return (
    <div className="no-touch-select relative z-10 grid grid-cols-2 gap-2.5 max-sm:order-2 max-sm:px-4 max-sm:pt-3">
      {([PlayerSymbol.X, PlayerSymbol.O] as const).map((playerSymbol) => {
        const player = gameState.players[playerSymbol];
        const isCurrent = gameState.currentPlayer === playerSymbol && isActive;
        return (
          <PlayerCard
            key={playerSymbol}
            playerSymbol={playerSymbol}
            player={player}
            isCurrent={isCurrent}
            isWinner={gameState.winner === playerSymbol}
            isAITurn={isAITurn && isCurrent}
            aiDifficultyLabel={
              player.type === PlayerTypes.COMPUTER && aiDifficulty
                ? AI_DIFFICULTY_LABELS[aiDifficulty]
                : undefined
            }
          />
        );
      })}
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
            <span className="ml-1 text-[11px] font-medium text-muted-foreground max-sm:text-xs landscape-short:ml-0 landscape-short:block">
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
        <div
          role="status"
          className="text-sm font-semibold max-sm:text-xl max-sm:font-bold text-emerald-600 dark:text-emerald-400"
        >
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
              Cancel rematch
            </Button>
          )}
          {onDeclineRematch && (
            <Button
              type="button"
              variant="glass"
              size="sm"
              onClick={onDeclineRematch}
            >
              Decline rematch
            </Button>
          )}
          {onRequestRematch && (
            <Button
              type="button"
              size="sm"
              onClick={onRequestRematch}
            >
              Rematch
            </Button>
          )}
          {onAcceptRematch && (
            <Button
              type="button"
              size="sm"
              onClick={onAcceptRematch}
            >
              Accept rematch
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
