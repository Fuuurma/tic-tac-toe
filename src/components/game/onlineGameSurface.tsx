import { useEffect, useState } from "react";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
} from "@/game/constants";
import { Board } from "./board";
import { PlayersPanel } from "./playersPanel";
import { Button } from "@/components/ui/button";
import { usePeerRoom, type PeerStatus } from "@/hooks/usePeerRoom";
import {
  PlayerSummaryCard,
  SettingsSheet,
  type PlayerSettings,
} from "@/components/lobby/playerSettingsSheet";
import { Check, Copy, Link2, Loader2, Share2, Wifi } from "lucide-react";

export interface OnlineGameSurfaceProps {
  config: {
    displayName: string;
    color: Color;
    playerShape: SymbolShape;
    gameMode: typeof GameModes.ONLINE;
    onlineRoomId: string;
    onlineAction: "create" | "join" | "quick";
  };
  onExit: () => void;
}

export function OnlineGameSurface({ config, onExit }: OnlineGameSurfaceProps) {
  const peer = usePeerRoom({
    hostDisplayName: config.displayName,
    hostColor: config.color,
    hostShape: config.playerShape,
    gameMode: GameModes.ONLINE,
  });

  useEffect(() => {
    if (config.onlineAction === "quick") {
      peer.startQuickMatch();
    } else if (config.onlineAction === "join" && config.onlineRoomId) {
      peer.joinAsGuest(config.onlineRoomId);
    } else {
      peer.startAsHost(config.onlineRoomId || undefined);
    }
    return () => {
      peer.leave();
    };
    // Intentionally empty deps: this component is remounted via the `key`
    // prop in App.tsx whenever the config changes, so the effect only runs
    // once per mount. Adding `config` or `peer` would cause double-connects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localSymbol: PlayerSymbol | null =
    peer.state.role === "host" ? peer.state.hostSymbol : peer.state.guestSymbol;

  const previewPlayer: PlayerSymbol | undefined =
    localSymbol !== null && peer.state.gameState.currentPlayer === localSymbol
      ? peer.state.gameState.currentPlayer
      : undefined;
  const previewColor: Color | undefined =
    localSymbol !== null
      ? peer.state.gameState.players[localSymbol]?.color
      : undefined;
  const showGame = ["connected", "reconnecting", "disconnected"].includes(peer.state.status);

  const message = onlineMessage(peer.state.status, peer.state.message);

  const [settingsOpen, setSettingsOpen] = useState(false);
  // Seed from the live host player data; the next rematch picks the values
  // up via `peer.updatePendingSettings`. We refresh the buffered values each
  // time the user opens the sheet so they always edit the latest identity.
  const hostSymbol =
    peer.state.role === "host" ? peer.state.hostSymbol : peer.state.guestSymbol;
  const hostPlayerFromState =
    hostSymbol && peer.state.role === "host"
      ? peer.state.gameState.players[hostSymbol]
      : null;
  const [pendingPlayerSettings, setPendingPlayerSettings] = useState<PlayerSettings>(
    hostPlayerFromState
      ? {
          displayName: hostPlayerFromState.username,
          color: hostPlayerFromState.color,
          playerShape: hostPlayerFromState.shape,
        }
      : {
          displayName: config.displayName,
          color: config.color,
          playerShape: config.playerShape,
        },
  );

  const handleOpenSettings = () => {
    if (hostPlayerFromState) {
      setPendingPlayerSettings({
        displayName: hostPlayerFromState.username,
        color: hostPlayerFromState.color,
        playerShape: hostPlayerFromState.shape,
      });
    }
    setSettingsOpen(true);
  };

  return (
    <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:gap-3">
      {/* Status banners — always on top so the user sees them first */}
      {peer.state.status === "waiting" && (
        <RoomIdShare
          roomId={peer.state.roomId}
          origin={typeof window !== "undefined" ? window.location.origin : ""}
          onCancel={() => {
            peer.leave();
            onExit();
          }}
        />
      )}
      {peer.state.status === "creating" && (
        <OnlineConnectionState
          message={config.onlineAction === "quick" ? "Finding an opponent…" : "Creating your room…"}
          onCancel={() => {
            peer.leave();
            onExit();
          }}
        />
      )}
      {peer.state.status === "connecting" && (
        <OnlineConnectionState
          message="Joining room…"
          onCancel={() => {
            peer.leave();
            onExit();
          }}
        />
      )}
      {peer.state.status === "reconnecting" && (
        <div
          role="status"
          aria-live="polite"
          className="glass flex w-full flex-col items-center gap-2 border-amber-500/40 bg-amber-500/15 px-3 py-2 text-amber-950 dark:text-amber-50"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {peer.state.message || "Reconnecting…"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Room stays open ~30s while the connection restores.
          </span>
          <Button
            size="sm"
            variant="glass"
            onClick={() => peer.retryReconnect()}
            className="h-7 px-3 text-xs"
          >
            Retry now
          </Button>
        </div>
      )}
      {peer.state.status === "error" && (
        <div
          role="alert"
          className="glass flex w-full flex-col items-center gap-2 border-destructive/30 bg-destructive/15 px-3 py-2"
        >
          <span className="text-xs text-destructive">
            {peer.state.message || "We could not connect to this room."}
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {config.onlineAction === "quick" && (
              <Button
                size="sm"
                variant="glass"
                onClick={() => {
                  void peer.startQuickMatch();
                }}
                className="h-8 px-3 text-xs"
              >
                Try again
              </Button>
            )}
            <Button
              size="sm"
              variant="glass"
              onClick={onExit}
              className="h-8 px-3 text-xs"
            >
              Back to setup
            </Button>
          </div>
        </div>
      )}
      {peer.state.status === "disconnected" && peer.state.message && (
        <div
          role="status"
          aria-live="polite"
          className="glass flex w-full flex-col items-center gap-2 border-amber-500/40 bg-amber-500/15 px-3 py-2"
        >
          <span className="text-xs font-medium text-amber-950 dark:text-amber-50">
            {peer.state.message}
          </span>
          <Button
            size="sm"
            variant="glass"
            onClick={onExit}
            className="h-8 px-3 text-xs"
          >
            Back to setup
          </Button>
        </div>
      )}

      {/* Game area — below the status banners */}
      {showGame && (
        <>
          <PlayersPanel
            gameState={peer.state.gameState}
            message={message}
            gameMode={GameModes.ONLINE}
            onNewGame={peer.state.status === "connected" ? () => peer.requestRematch() : undefined}
            onExit={() => {
              peer.leave();
              onExit();
            }}
          />
          <PlayerSummaryCard
            settings={pendingPlayerSettings}
            gameMode={GameModes.ONLINE}
            onEdit={peer.state.role === "host" ? handleOpenSettings : undefined}
          />
          {peer.state.status === "connected" && peer.state.guestDisplayName && (
            <span className="text-center text-xs text-muted-foreground">
              Opponent: {peer.state.guestDisplayName}
            </span>
          )}

          <Board
            board={peer.state.gameState.board}
            colors={{
              [PlayerSymbol.X]: peer.state.gameState.players[PlayerSymbol.X].color,
              [PlayerSymbol.O]: peer.state.gameState.players[PlayerSymbol.O].color,
            }}
            shapes={{
              [PlayerSymbol.X]: peer.state.gameState.players[PlayerSymbol.X].shape,
              [PlayerSymbol.O]: peer.state.gameState.players[PlayerSymbol.O].shape,
            }}
            winningCombination={peer.state.gameState.winningCombination}
            nextToRemove={peer.state.gameState.nextToRemove}
            previewPlayer={previewPlayer}
            previewColor={previewColor}
            previewShape={previewPlayer ? peer.state.gameState.players[previewPlayer].shape : undefined}
            disabled={
              peer.state.status !== "connected" ||
              localSymbol === null ||
              peer.state.gameState.currentPlayer !== localSymbol ||
              peer.state.gameState.gameStatus !== "ACTIVE"
            }
            onCellClick={peer.sendMove}
          />
        </>
      )}
      <SettingsSheet
        isOpen={settingsOpen && peer.state.role === "host"}
        gameMode={GameModes.ONLINE}
        tab="player"
        onTabChange={() => undefined}
        player={pendingPlayerSettings}
        opponent={{
          opponentName: "Opponent",
          opponentColor: Color.GRAY,
          opponentShape: SymbolShape.O,
          opponentType: PlayerTypes.HUMAN,
          aiDifficulty: AI_Difficulty.EASY,
        }}
        onPlayerChange={setPendingPlayerSettings}
        onOpponentChange={() => undefined}
        onClose={() => {
          // Persist the edits so the next rematch picks them up.
          if (peer.state.role === "host") {
            peer.updatePendingSettings({
              displayName: pendingPlayerSettings.displayName,
              color: pendingPlayerSettings.color,
              playerShape: pendingPlayerSettings.playerShape,
            });
          }
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

function onlineMessage(status: PeerStatus, fallback: string): string {
  if (status === "creating") return "Finding match…";
  if (status === "waiting") return "Waiting for opponent…";
  if (status === "connecting") return "Connecting…";
  if (status === "reconnecting") return fallback || "Reconnecting…";
  if (status === "error") return fallback;
  return fallback;
}

function RoomIdShare({
  roomId,
  origin,
  onCancel,
}: {
  roomId: string;
  origin: string;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [copyError, setCopyError] = useState(false);
  const shareUrl = origin ? `${origin}/?room=${roomId}` : roomId;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onCopy = async (kind: "code" | "link", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(false);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopyError(true);
    }
  };

  const onShare = async () => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: "Tic Tac Toe Disappear room",
        text: `Join my Tic Tac Toe Disappear room with code ${roomId}`,
        url: shareUrl,
      });
    } catch {
      // The user may cancel the native share sheet; no error is needed.
    }
  };

  return (
    <div className="glass flex w-full flex-col items-center gap-2 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Wifi className="size-3.5 text-[rgb(var(--player-color))]" aria-hidden="true" />
        Room ready
      </div>
      <p className="text-xs leading-tight text-muted-foreground">
        Send this code to your opponent; you start when they join.
      </p>
      <span
        aria-label={`Room code ${roomId}`}
        className="glass-cell rounded-lg px-4 py-2 font-mono text-xl font-bold tracking-[0.2em] text-foreground"
      >
        {roomId}
      </span>
      <div className="grid w-full gap-1.5 sm:flex sm:w-auto">
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("code", roomId)}
          className="w-full sm:w-auto"
        >
          {copied === "code" ? (
            <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          Copy code
        </Button>
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("link", shareUrl)}
          className="w-full sm:w-auto"
        >
          {copied === "link" ? (
            <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <Link2 className="size-3.5" aria-hidden="true" />
          )}
          Copy invite link
        </Button>
        {canShare && (
          <Button size="sm" variant="glass" onClick={onShare} className="w-full sm:w-auto">
            <Share2 className="size-3.5" aria-hidden="true" />
            Share
          </Button>
        )}
        <Button
          size="sm"
          variant="glass"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Back to setup
        </Button>
      </div>
      {copied && (
        <span role="status" aria-live="polite" className="text-xs text-emerald-600 dark:text-emerald-400">
          {copied === "code" ? "Room code copied." : "Invite link copied."}
        </span>
      )}
      {copyError && (
        <span role="status" aria-live="polite" className="text-xs text-destructive">
          Copy was unavailable. Select the code manually.
        </span>
      )}
    </div>
  );
}

function OnlineConnectionState({
  message,
  onCancel,
}: {
  message: string;
  onCancel: () => void;
}) {
  return (
    <div className="glass flex flex-col items-center gap-2 p-4">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Loader2 className="size-4 animate-spin text-[rgb(var(--player-color))]" aria-hidden="true" />
        {message}
      </span>
      <p className="text-[11px] leading-tight text-muted-foreground">
        You can return to setup if you want to choose a different room.
      </p>
      <Button size="sm" variant="glass" onClick={onCancel}>
        Back to setup
      </Button>
    </div>
  );
}
