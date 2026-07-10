import { useEffect, useRef, useState } from "react";
import {
  Color,
  GameModes,
  PlayerSymbol,
  type AI_Difficulty as AI_DifficultyType,
} from "@/game/constants";
import { canMakeMove } from "@/game/logic";
import { LoginForm, type LoginFormPayload } from "@/components/auth/loginForm";
import { Board } from "@/components/game/board";
import { PlayersPanel } from "@/components/game/playersPanel";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameStats } from "@/hooks/useGameStats";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { Wifi, Loader2, Copy, Check } from "lucide-react";

type View = "login" | "game";

interface GameConfig {
  displayName: string;
  color: Color;
  gameMode: typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND | typeof GameModes.ONLINE;
  aiDifficulty: AI_DifficultyType;
  opponentName: string;
  onlineRoomId: string;
  onlineAction: "create" | "join";
}

export default function App() {
  const [view, setView] = useState<View>("login");
  const [config, setConfig] = useState<GameConfig | null>(null);

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
  };

  const handleExit = () => {
    setView("login");
    setConfig(null);
  };

  return (
    <main className="flex h-dvh w-full items-center justify-center overflow-y-auto bg-[image:var(--gradient-light)] p-3 dark:bg-[image:var(--gradient-dark)] sm:p-4">
      {view === "login" && <LoginForm onStart={handleStart} />}
      {view === "game" && config && (
        <GameView key={JSON.stringify(config)} config={config} onExit={handleExit} />
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
  return <OnlineGameSurface config={config} onExit={onExit} />;
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
  const recordedGameId = useRef<number>(0);

  useEffect(() => {
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

function OnlineGameSurface({
  config,
  onExit,
}: {
  config: GameConfig;
  onExit: () => void;
}) {
  const peer = usePeerRoom({
    hostDisplayName: config.displayName,
    hostColor: config.color,
    gameMode: GameModes.ONLINE,
  });

  useEffect(() => {
    if (config.onlineAction === "create") {
      peer.startAsHost();
    } else if (config.onlineRoomId) {
      peer.joinAsGuest(config.onlineRoomId);
    }
    return () => {
      peer.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localSymbol: PlayerSymbol | null =
    peer.state.role === "host"
      ? PlayerSymbol.X
      : peer.state.guestSymbol;

  const previewPlayer: PlayerSymbol | undefined =
    localSymbol !== null && peer.state.gameState.currentPlayer === localSymbol
      ? peer.state.gameState.currentPlayer
      : undefined;
  const previewColor: Color | undefined =
    localSymbol === PlayerSymbol.X
      ? config.color
      : peer.state.gameState.players[PlayerSymbol.O]?.color;

  const message = onlineMessage(peer.state.status, peer.state.message, peer.state.roomId);

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:gap-3">
      <PlayersPanel
        gameState={peer.state.gameState}
        message={message}
        onNewGame={() => peer.requestRematch()}
        onExit={() => {
          peer.leave();
          onExit();
        }}
      />
      <Board
        board={peer.state.gameState.board}
        colors={{
          [PlayerSymbol.X]: peer.state.gameState.players[PlayerSymbol.X].color,
          [PlayerSymbol.O]: peer.state.gameState.players[PlayerSymbol.O].color,
        }}
        currentPlayer={peer.state.gameState.currentPlayer}
        winningCombination={peer.state.gameState.winningCombination}
        nextToRemove={peer.state.gameState.nextToRemove}
        previewPlayer={previewPlayer}
        previewColor={previewColor}
        disabled={
          peer.state.status !== "connected" ||
          localSymbol === null ||
          peer.state.gameState.currentPlayer !== localSymbol
        }
        onCellClick={peer.sendMove}
      />
      <div className="text-center text-xs text-muted-foreground">
        {peer.state.status === "waiting" && (
          <RoomIdShare
            roomId={peer.state.roomId}
            origin={typeof window !== "undefined" ? window.location.origin : ""}
          />
        )}
        {peer.state.status === "connecting" && (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting…
          </span>
        )}
        {peer.state.status === "connected" && peer.state.guestDisplayName && (
          <span>Opponent: {peer.state.guestDisplayName}</span>
        )}
        {peer.state.status === "error" && (
          <span className="text-destructive">{peer.state.message}</span>
        )}
      </div>
    </div>
  );
}

function onlineMessage(status: string, fallback: string, _roomId: string): string {
  if (status === "waiting") return "Waiting for opponent…";
  if (status === "connecting") return "Connecting…";
  if (status === "error") return fallback;
  return fallback;
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

function RoomIdShare({ roomId, origin }: { roomId: string; origin: string }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = origin ? `${origin}/?room=${roomId}` : roomId;

  const onCopy = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1">
        <Wifi className="h-3 w-3 animate-pulse-slow" />
        Waiting for opponent
      </span>
      <div className="flex items-center gap-1 rounded-md border bg-background/80 px-2 py-1 font-mono text-sm font-semibold">
        <span aria-label={`Room code ${roomId}`}>{roomId}</span>
        <button
          type="button"
          aria-label="Copy room code"
          onClick={() => onCopy(roomId)}
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => onCopy(shareUrl)}
        className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Copy invite link
      </button>
    </div>
  );
}
