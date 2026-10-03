import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/errorBoundary";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
  type AI_Difficulty as AI_DifficultyType,
  type PlayerType,
} from "@/game/constants";

import { LobbyForm, type LobbyFormPayload } from "@/components/lobby/lobbyForm";
import { BackgroundPattern } from "@/components/backgroundPattern";
import { Board } from "@/components/game/board";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { PlayersPanel } from "@/components/game/playersPanel";
import {
  SettingsSheet,
  type OpponentSettings,
  type PlayerSettings,
  type SettingsTab,
} from "@/components/lobby/playerSettingsSheet";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameStats } from "@/hooks/useGameStats";
import { normalizeRoomId } from "@/lib/roomId";

const OnlineGameSurface = lazy(() =>
  import("./components/game/onlineGameSurface").then((m) => ({ default: m.OnlineGameSurface })),
);

type View = "login" | "game";

interface GameConfig {
  displayName: string;
  color: Color;
  opponentColor: Color;
  playerShape: SymbolShape;
  opponentShape: SymbolShape;
  gameMode: typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND | typeof GameModes.ONLINE;
  aiDifficulty: AI_DifficultyType;
  opponentName: string;
  opponentType: PlayerType;
  onlineRoomId: string;
  onlineAction: "create" | "join" | "quick";
}

export default function App() {
  const [view, setView] = useState<View>("login");
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [initialRoomId] = useState(() => {
    if (typeof window === "undefined") return "";
    return normalizeRoomId(new URLSearchParams(window.location.search).get("room"));
  });

  const handleStart = (payload: LobbyFormPayload) => {
    setConfig({
      displayName: payload.displayName,
      color: payload.color,
      opponentColor: payload.opponentColor,
      playerShape: payload.playerShape,
      opponentShape: payload.opponentShape,
      gameMode: payload.gameMode,
      aiDifficulty: payload.aiDifficulty,
      opponentName: payload.opponentName,
      opponentType: payload.opponentType,
      onlineRoomId: payload.onlineRoomId,
      onlineAction: payload.onlineAction,
    });
    setView("game");
    if (payload.onlineRoomId && typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const handleExit = () => {
    setView("login");
    setConfig(null);
  };

  return (
    <main id="main-content" className="relative isolate flex h-dvh w-full items-start justify-center overflow-y-auto bg-[image:var(--gradient-light)] p-3 dark:bg-[image:var(--gradient-dark)] sm:items-center sm:p-4">
      {/* Living symbol field: canvas layer above the gradient base */}
      <BackgroundPattern />
      {/* Centered black mask keeps the board readable over the symbol texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-[image:var(--bg-mask-light)] dark:bg-[image:var(--bg-mask-dark)]"
      />
      <div className="relative z-10 my-auto flex w-full justify-center">
        {view === "login" && (
          <LobbyForm initialRoomId={initialRoomId} onStart={handleStart} />
        )}
        {view === "game" && config && (
          <ErrorBoundary>
            <Suspense fallback={<GameSurfaceFallback />}>
              <GameView
                key={`${config.gameMode}:${config.displayName}:${config.opponentName}:${config.onlineRoomId}`}
                config={config}
                onExit={handleExit}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </main>
  );
}

function GameView({ config, onExit }: { config: GameConfig; onExit: () => void }) {
  const isOnline = config.gameMode === GameModes.ONLINE;

  if (!isOnline) {
    return (
      <LocalGameSurface
        config={config}
        onExit={onExit}
      />
    );
  }
  return (
    <OnlineGameSurface
      config={{
        displayName: config.displayName,
        color: config.color,
        playerShape: config.playerShape,
        gameMode: GameModes.ONLINE,
        onlineRoomId: config.onlineRoomId,
        onlineAction: config.onlineAction,
      }}
      onExit={onExit}
    />
  );
}

function LocalGameSurface({
  config,
  onExit,
}: {
  config: GameConfig;
  onExit: () => void;
}) {
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
    displayName: config.displayName,
    color: config.color,
    playerShape: config.playerShape,
  });
  const [opponentSettings, setOpponentSettings] = useState<OpponentSettings>({
    opponentName: config.opponentName,
    opponentColor: config.opponentColor,
    opponentShape: config.opponentShape,
    opponentType: config.opponentType,
    aiDifficulty: config.aiDifficulty,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("player");
  const [helpOpen, setHelpOpen] = useState(false);

  const input = useMemo(
    () => ({
      gameMode: config.gameMode as typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND,
      playerName: playerSettings.displayName,
      opponentName: opponentSettings.opponentName,
      playerColor: playerSettings.color,
      opponentColor: opponentSettings.opponentColor,
      playerShape: playerSettings.playerShape,
      opponentShape: opponentSettings.opponentShape,
      aiDifficulty: opponentSettings.aiDifficulty,
      opponentType: opponentSettings.opponentType,
    }),
    [
      config.gameMode,
      playerSettings.displayName,
      playerSettings.color,
      playerSettings.playerShape,
      opponentSettings.opponentName,
      opponentSettings.opponentColor,
      opponentSettings.opponentShape,
      opponentSettings.aiDifficulty,
      opponentSettings.opponentType,
    ],
  );
  const { gameState, humanSymbol, handleCellClick, handleReset, exit, setPaused } = useLocalGame(input);
  const { stats, recordWin, recordLoss } = useGameStats();
  const recordedGameId = useRef<number>(-1);
  const [panelPaused, setPanelPaused] = useState(false);

  useEffect(() => {
    setPaused(settingsOpen || helpOpen || panelPaused);
  }, [settingsOpen, helpOpen, panelPaused, setPaused]);

  useEffect(() => {
    // Reset the recorded-game marker when a fresh game starts.
    if (gameState.gameStatus === GameStatus.ACTIVE && gameState.moveCount === 0) {
      recordedGameId.current = -1;
    }
    if (gameState.winner !== null) {
      if (gameState.moveCount === recordedGameId.current) return;
      recordedGameId.current = gameState.moveCount;
      if (gameState.winner === humanSymbol) recordWin();
      else recordLoss();
    }
  }, [
    gameState.winner,
    gameState.gameStatus,
    gameState.moveCount,
    humanSymbol,
    recordWin,
    recordLoss,
  ]);

  const previewPlayer =
    gameState.players[gameState.currentPlayer].type === PlayerTypes.HUMAN
      ? gameState.currentPlayer
      : undefined;
  const previewColor = previewPlayer
    ? gameState.players[previewPlayer].color
    : undefined;

  const isAITurn =
    gameState.gameStatus === GameStatus.ACTIVE &&
    gameState.players[gameState.currentPlayer].type === PlayerTypes.COMPUTER;
  const isBoardDisabled =
    isAITurn || gameState.gameStatus !== GameStatus.ACTIVE;

  return (
    <div className="relative flex w-full max-w-md flex-col items-stretch gap-2 sm:gap-3">
      <PlayersPanel
        gameState={gameState}
        stats={stats}
        gameMode={config.gameMode}
        aiDifficulty={
          config.gameMode === GameModes.VS_COMPUTER
            ? opponentSettings.aiDifficulty
            : undefined
        }
        message=""
        onNewGame={handleReset}
        onExit={() => {
          exit();
          onExit();
        }}
        onHelp={() => setHelpOpen(true)}
        onEditSettings={() => {
          setSettingsTab("player");
          setSettingsOpen(true);
        }}
        onPauseChange={setPanelPaused}
      />
      <Board
        board={gameState.board}
        colors={{
          [PlayerSymbol.X]: gameState.players[PlayerSymbol.X].color,
          [PlayerSymbol.O]: gameState.players[PlayerSymbol.O].color,
        }}
        shapes={{
          [PlayerSymbol.X]: gameState.players[PlayerSymbol.X].shape,
          [PlayerSymbol.O]: gameState.players[PlayerSymbol.O].shape,
        }}
        winningCombination={gameState.winningCombination}
        nextToRemove={gameState.nextToRemove}
        previewPlayer={previewPlayer}
        previewColor={previewColor}
        previewShape={previewPlayer ? gameState.players[previewPlayer].shape : undefined}
        disabled={isBoardDisabled}
        onCellClick={handleCellClick}
      />
      <HelpDrawer
        inline
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <SettingsSheet
        isOpen={settingsOpen}
        gameMode={config.gameMode as typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        player={playerSettings}
        opponent={opponentSettings}
        onPlayerChange={setPlayerSettings}
        onOpponentChange={setOpponentSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

// Skeleton of the game surface (players panel + board well) shown while the
// lazy online chunk loads. Mirrors the real layout so the swap doesn't shift,
// and uses the app's loading vocabulary — glass-cell placeholders with the
// pulse-slow token plus the Loader2 spinner used on every other busy surface.
function GameSurfaceFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative flex w-full max-w-md flex-col items-stretch gap-2 sm:gap-3"
    >
      {/* Players panel skeleton */}
      <div
        aria-hidden="true"
        className="glass w-full rounded-2xl px-4 py-4 sm:px-5 sm:py-5"
      >
        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-3.5">
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-16 rounded-md bg-muted-foreground/15 animate-pulse-slow" />
            <div className="h-3.5 w-28 rounded-md bg-muted-foreground/15 animate-pulse-slow" />
          </div>
          <div className="flex gap-1.5">
            <div className="size-9 rounded-lg bg-muted-foreground/15 animate-pulse-slow sm:size-10" />
            <div className="size-9 rounded-lg bg-muted-foreground/15 animate-pulse-slow sm:size-10" />
            <div className="size-9 rounded-lg bg-muted-foreground/15 animate-pulse-slow sm:size-10" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="glass-cell h-[52px] rounded-xl animate-pulse-slow sm:h-14" />
          <div className="glass-cell h-[52px] rounded-xl animate-pulse-slow sm:h-14" />
        </div>
      </div>
      {/* Board well skeleton — same shell as Board so dimensions match */}
      <div
        aria-hidden="true"
        className="relative mx-auto aspect-square w-full rounded-2xl border border-white/12 bg-black/50 p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_18px_40px_rgb(0_0_0/0.4)] sm:p-3.5"
      >
        <div className="grid h-full w-full grid-rows-3 gap-1.5 sm:gap-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[0, 1, 2].map((col) => (
                <div
                  key={col}
                  className="glass-cell rounded-xl animate-pulse-slow"
                />
              ))}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <span className="glass inline-flex items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground">
            <Loader2
              className="size-4 animate-spin text-[rgb(var(--player-color))]"
              aria-hidden="true"
            />
            Loading game…
          </span>
        </div>
      </div>
    </div>
  );
}
