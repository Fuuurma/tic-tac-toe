import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
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

import { LoginForm, type LoginFormPayload } from "@/components/lobby/loginForm";
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

  const handleStart = (payload: LoginFormPayload) => {
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
          <LoginForm initialRoomId={initialRoomId} onStart={handleStart} />
        )}
        {view === "game" && config && (
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
            <GameView
              key={`${config.gameMode}:${config.displayName}:${config.opponentName}:${config.onlineRoomId}`}
              config={config}
              onExit={handleExit}
            />
          </Suspense>
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
  const { gameState, humanSymbol, handleCellClick, handleReset, exit } = useLocalGame(input);
  const { stats, recordWin, recordLoss } = useGameStats();
  const recordedGameId = useRef<number>(-1);

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
