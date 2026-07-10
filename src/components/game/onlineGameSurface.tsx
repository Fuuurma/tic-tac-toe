import { useEffect, useState } from "react";
import {
  Color,
  GameModes,
  PlayerSymbol,
} from "@/game/constants";
import { Board } from "./board";
import { PlayersPanel } from "./playersPanel";
import { usePeerRoom } from "@/hooks/usePeerRoom";
import { Check, Copy, Loader2, Wifi } from "lucide-react";

export interface OnlineGameSurfaceProps {
  config: {
    displayName: string;
    color: Color;
    gameMode: typeof GameModes.ONLINE;
    onlineRoomId: string;
  };
  onExit: () => void;
}

export function OnlineGameSurface({ config, onExit }: OnlineGameSurfaceProps) {
  const peer = usePeerRoom({
    hostDisplayName: config.displayName,
    hostColor: config.color,
    gameMode: GameModes.ONLINE,
  });

  useEffect(() => {
    if (config.onlineRoomId) {
      peer.joinAsGuest(config.onlineRoomId);
    } else {
      peer.startAsHost();
    }
    return () => {
      peer.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const localSymbol: PlayerSymbol | null =
    peer.state.role === "host" ? PlayerSymbol.X : peer.state.guestSymbol;

  const previewPlayer: PlayerSymbol | undefined =
    localSymbol !== null && peer.state.gameState.currentPlayer === localSymbol
      ? peer.state.gameState.currentPlayer
      : undefined;
  const previewColor: Color | undefined =
    localSymbol === PlayerSymbol.X
      ? config.color
      : peer.state.gameState.players[PlayerSymbol.O]?.color;

  const message = onlineMessage(peer.state.status, peer.state.message);

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

function onlineMessage(status: string, fallback: string): string {
  if (status === "waiting") return "Waiting for opponent…";
  if (status === "connecting") return "Connecting…";
  if (status === "error") return fallback;
  return fallback;
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