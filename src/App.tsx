import { Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  type AI_Difficulty as AI_DifficultyType,
} from "@/game/constants";
import { canMakeMove } from "@/game/logic";
import { LoginForm, type LoginFormPayload } from "@/components/auth/loginForm";
import { Board } from "@/components/game/board";
import { PlayersPanel } from "@/components/game/playersPanel";
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
  gameMode: typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND | typeof GameModes.ONLINE;
  aiDifficulty: AI_DifficultyType;
  opponentName: string;
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
      gameMode: payload.gameMode,
      aiDifficulty: payload.aiDifficulty,
      opponentName: payload.opponentName,
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
    <main className="flex h-dvh w-full items-center justify-center overflow-y-auto bg-[image:var(--gradient-light)] p-3 dark:bg-[image:var(--gradient-dark)] sm:p-4">
      {view === "login" && (
        <LoginForm initialRoomId={initialRoomId} onStart={handleStart} />
      )}
      {view === "game" && config && (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <GameView key={JSON.stringify(config)} config={config} onExit={handleExit} />
        </Suspense>
      )}
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
  const { gameState, handleCellClick, handleReset, exit } = useLocalGame({
    gameMode: config.gameMode as typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND,
    playerXName: config.displayName,
    playerOName: config.opponentName,
    playerColor: config.color,
    opponentColor: oppositeColor(config.color),
    aiDifficulty: config.aiDifficulty,
  });
  const { stats, recordWin, recordLoss, recordDraw } = useGameStats();
  const recordedGameId = useRef<number>(-1);

  useEffect(() => {
    // Reset the recorded-game marker when a fresh game starts.
    if (gameState.gameStatus === GameStatus.ACTIVE && gameState.moveCount === 0) {
      recordedGameId.current = -1;
    }
    if (gameState.winner !== null) {
      if (gameState.moveCount === recordedGameId.current) return;
      recordedGameId.current = gameState.moveCount;
      if (gameState.winner === PlayerSymbol.X) recordWin();
      else recordLoss();
    } else if (gameState.gameStatus === "COMPLETED" && gameState.moveCount > 0) {
      if (gameState.moveCount === recordedGameId.current) return;
      recordedGameId.current = gameState.moveCount;
      recordDraw();
    }
  }, [gameState.winner, gameState.gameStatus, gameState.moveCount, recordWin, recordLoss, recordDraw]);

  const previewPlayer = canMakeMove(
    gameState.gameMode,
    gameState.currentPlayer,
    PlayerSymbol.X,
  )
    ? gameState.currentPlayer
    : undefined;

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:gap-3">
      <PlayersPanel
        gameState={gameState}
        stats={stats}
        gameMode={config.gameMode}
        message=""
        onNewGame={handleReset}
        onExit={() => {
          exit();
          onExit();
        }}
      />
      <Board
        board={gameState.board}
        colors={{
          [PlayerSymbol.X]: gameState.players[PlayerSymbol.X].color,
          [PlayerSymbol.O]: gameState.players[PlayerSymbol.O].color,
        }}
        currentPlayer={gameState.currentPlayer}
        winningCombination={gameState.winningCombination}
        nextToRemove={gameState.nextToRemove}
        previewPlayer={previewPlayer}
        previewColor={config.color}
        disabled={false}
        onCellClick={handleCellClick}
      />
    </div>
  );
}

const OPPOSITE_COLOR: Record<Color, Color> = {
  [Color.BLUE]: Color.RED,
  [Color.GREEN]: Color.PURPLE,
  [Color.YELLOW]: Color.ORANGE,
  [Color.ORANGE]: Color.YELLOW,
  [Color.RED]: Color.BLUE,
  [Color.PINK]: Color.GREEN,
  [Color.PURPLE]: Color.GREEN,
  [Color.GRAY]: Color.GRAY,
};

function oppositeColor(color: Color): Color {
  return OPPOSITE_COLOR[color] ?? Color.GRAY;
}
