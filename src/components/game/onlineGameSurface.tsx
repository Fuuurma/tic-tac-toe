import { useEffect, useMemo, useRef, useState } from "react";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
} from "@/game/constants";
import { GameStatus } from "@/game/constants";
import { Board } from "./board";
import { PlayersPanel } from "./playersPanel";
import { Button } from "@/components/ui/button";
import { usePeerRoom, type PeerStatus } from "@/hooks/usePeerRoom";
import { usePlayerCount } from "@/hooks/usePlayerCount";
import { useGameStats } from "@/hooks/useGameStats";
import { saveDisplayName } from "@/lib/identity";
import { savePreferences } from "@/lib/preferences";
import {
  SettingsSheet,
  type PlayerSettings,
} from "@/components/lobby/playerSettingsSheet";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { Check as CheckIcon, Copy as CopyIcon, Link2 as LinkIcon } from "lucide";
import { Loader2, Share2, Wifi } from "lucide-react";
import { MorphIcon } from "morphicons/react";

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
  // Only the searching state needs the live count, and only Quick Match has
  // a searching state worth watching.
  const { count: playerCount } = usePlayerCount(
    config.onlineAction === "quick" &&
      (peer.state.status === "waiting" || peer.state.status === "creating"),
  );

  // Connection effect: runs when the action or room ID changes.
  // The cleanup leaves the room before re-connecting, so changing the action
  // mid-session disconnects cleanly instead of leaking a stale connection.
  // This is self-contained — it does NOT rely on the parent remounting via
  // a `key` prop to reset the connection.
  //
  // The peer ACTION functions are useCallback-stable in usePeerRoom, so
  // the effect depends on them individually — NOT on the `peer` object,
  // which is a fresh literal every render (dep on `peer` + the 1s turn
  // timer re-render = leave/reconnect every second; regression caught by
  // the fleet critic 2026-09-06). The old render-time
  // `peerRef.current = peer` sync violated the ref rules and is gone.
  const { startQuickMatch, joinAsGuest, startAsHost, leave } = peer;
  useEffect(() => {
    if (config.onlineAction === "quick") {
      startQuickMatch();
    } else if (config.onlineAction === "join" && config.onlineRoomId) {
      joinAsGuest(config.onlineRoomId);
    } else {
      startAsHost(config.onlineRoomId || undefined);
    }
    return () => {
      leave();
    };
  }, [config.onlineAction, config.onlineRoomId, startQuickMatch, joinAsGuest, startAsHost, leave]);

  const localSymbol: PlayerSymbol | null =
    peer.state.role === "host" ? peer.state.hostSymbol : peer.state.guestSymbol;

  // Record online game results (fleet audit 2026-09-02 P2-6: online
  // wins/losses were silently dropped — useGameStats was only wired in
  // LocalGameSurface).
  const { recordWin, recordLoss } = useGameStats();
  // F474: one result per terminal episode. The old dedupe keyed on
  // moveCount, which is host-controlled — a host resending the same
  // terminal frame with a different accepted moveCount inflated the
  // guest's tally. Re-arm only on a genuinely live frame (gameStart /
  // rematch / WAITING), so reconnect and resync replays of the same
  // terminal state cannot recount.
  const resultRecorded = useRef(false);
  useEffect(() => {
    const terminal =
      peer.state.gameState.winner !== null ||
      peer.state.gameState.gameStatus === GameStatus.COMPLETED;
    if (!terminal) {
      resultRecorded.current = false;
      return;
    }
    if (
      resultRecorded.current ||
      localSymbol === null ||
      peer.state.gameState.winner === null
    ) {
      return;
    }
    resultRecorded.current = true;
    if (peer.state.gameState.winner === localSymbol) {
      recordWin({ gameMode: GameModes.ONLINE });
    } else {
      recordLoss({ gameMode: GameModes.ONLINE });
    }
  }, [
    peer.state.gameState.winner,
    peer.state.gameState.gameStatus,
    localSymbol,
    recordWin,
    recordLoss,
  ]);

  const previewPlayer: PlayerSymbol | undefined =
    localSymbol !== null && peer.state.gameState.currentPlayer === localSymbol
      ? peer.state.gameState.currentPlayer
      : undefined;
  const previewColor: Color | undefined =
    localSymbol !== null
      ? peer.state.gameState.players[localSymbol]?.color
      : undefined;
  // Stable across a turn-clock tick, so Board's memo actually holds. Fresh
  // object literals here failed every comparison and re-rendered all nine
  // cells once a second for nothing.
  const boardColors = useMemo(
    () => ({
      [PlayerSymbol.X]: peer.state.gameState.players[PlayerSymbol.X].color,
      [PlayerSymbol.O]: peer.state.gameState.players[PlayerSymbol.O].color,
    }),
    [peer.state.gameState.players],
  );
  const boardShapes = useMemo(
    () => ({
      [PlayerSymbol.X]: peer.state.gameState.players[PlayerSymbol.X].shape,
      [PlayerSymbol.O]: peer.state.gameState.players[PlayerSymbol.O].shape,
    }),
    [peer.state.gameState.players],
  );
  const showGame = ["connected", "reconnecting", "disconnected"].includes(peer.state.status);

  const message = onlineMessage(peer.state.status, peer.state.message);

  // Online rematch is terminal-only: requestRematch no-ops mid-game for both
  // roles, so don't offer "Start a new game" until the game is over. While
  // the opponent's request is on screen the labeled Accept/Decline prompt
  // IS the answer, so asking again would be a second, contradictory offer.
  const isOnlineGameOver =
    peer.state.gameState.winner !== null ||
    peer.state.gameState.gameStatus !== GameStatus.ACTIVE;
  const canRequestRematch =
    peer.state.status === "connected" &&
    isOnlineGameOver &&
    !peer.state.rematchIncoming &&
    !peer.state.rematchOutgoing;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [panelPaused, setPanelPaused] = useState(false);
  // Mid-game overlays pause the turn clock like local play does: without
  // this the host's 10s timer keeps running (and can force a random move)
  // while the Settings sheet, Help drawer, or exit/rematch confirm is open.
  const setPeerPaused = peer.setPaused;
  useEffect(() => {
    setPeerPaused(settingsOpen || helpOpen || panelPaused);
  }, [settingsOpen, helpOpen, panelPaused, setPeerPaused]);
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
    <div className="relative flex w-full max-w-md flex-col items-stretch gap-2 sm:gap-3">
      {/* Status banners — always on top so the user sees them first.
          A room code is an invitation token for a specific person, so it
          belongs to "create a room" only. Quick match is paired by the
          service; surfacing its internal room id would hand out a join key
          for a match nobody asked to be in. */}
      {peer.state.status === "waiting" && config.onlineAction === "create" && (
        <RoomIdShare
          roomId={peer.state.roomId}
          origin={typeof window !== "undefined" ? window.location.origin : ""}
          onCancel={() => {
            peer.leave();
            onExit();
          }}
        />
      )}
      {peer.state.status === "waiting" && config.onlineAction === "quick" && (
        <OnlineConnectionState
          message="Finding an opponent…"
          detail={quickMatchDetail(playerCount?.players, peer.state.queuePosition)}
          hint="No room code needed — we'll pair you automatically."
          cancelLabel="Cancel search"
          onCancel={() => {
            peer.leave();
            onExit();
          }}
        />
      )}
      {peer.state.status === "creating" && (
        <OnlineConnectionState
          message={config.onlineAction === "quick" ? "Finding an opponent…" : "Creating your room…"}
          detail={
            config.onlineAction === "quick" && peer.state.queuePosition != null
              ? `Position ${peer.state.queuePosition} in queue`
              : undefined
          }
          onCancel={() => {
            peer.leave();
            onExit();
          }}
        />
      )}
      {peer.state.status === "connecting" && (
        <OnlineConnectionState
          // relayEvents already writes the accurate reason here ("Waiting
          // for host…", a relay rejection, a room-not-found). A hardcoded
          // string threw it away, so a join that fails for a knowable
          // reason spun on "Joining room…" indefinitely with no way to tell
          // a slow host from a dead room.
          message={peer.state.message || "Joining room…"}
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
            className="px-3 text-xs"
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
                className="px-3 text-xs"
              >
                Try again
              </Button>
            )}
            <Button
              size="sm"
              variant="glass"
              onClick={onExit}
              className="px-3 text-xs"
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
            className="px-3 text-xs"
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
            roomCode={
              // Same rule as the share banner: the HUD's copyable chip is a
              // join credential, and a quick match was never something the
              // opponent was invited to.
              config.onlineAction === "quick" ? undefined : peer.state.roomId || undefined
            }
            onNewGame={
              // Either side may ask for another game; the receiver answers
              // with Accept or Decline. Both roles get the same controls.
              canRequestRematch ? () => peer.requestRematch() : undefined
            }
            onHelp={() => setHelpOpen(true)}
            onEditSettings={peer.state.role === "host" ? handleOpenSettings : undefined}
            onPauseChange={setPanelPaused}
            paused={peer.paused || peer.hostPaused || settingsOpen || helpOpen}
            onAcceptRematch={
              peer.state.rematchIncoming ? () => peer.acceptRematch() : undefined
            }
            onDeclineRematch={
              peer.state.rematchIncoming ? () => peer.declineRematch() : undefined
            }
            onCancelRematch={
              peer.state.rematchOutgoing ? () => peer.cancelRematch() : undefined
            }
            onRequestRematch={
              canRequestRematch && !peer.state.rematchOutgoing
                ? () => peer.requestRematch()
                : undefined
            }
            onExit={() => {
              peer.leave();
              onExit();
            }}
          />

          <Board
            board={peer.state.gameState.board}
            colors={boardColors}
            shapes={boardShapes}
            winningCombination={peer.state.gameState.winningCombination}
            nextToRemove={peer.state.gameState.nextToRemove}
            previewPlayer={previewPlayer}
            previewColor={previewColor}
            previewShape={previewPlayer ? peer.state.gameState.players[previewPlayer].shape : undefined}
            disabled={
              peer.paused ||
              peer.hostPaused ||
              peer.state.status !== "connected" ||
              localSymbol === null ||
              peer.state.gameState.currentPlayer !== localSymbol ||
              peer.state.gameState.gameStatus !== "ACTIVE"
            }
            disabledReason={
              peer.paused || peer.hostPaused
                ? "game is paused"
                : peer.state.status !== "connected"
                  ? "not connected to your opponent"
                  : peer.state.gameState.currentPlayer !== localSymbol
                    ? "waiting for your opponent to move"
                    : peer.state.gameState.gameStatus !== "ACTIVE"
                      ? "game is over"
                      : undefined
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
          // Persist the edits so the next rematch picks them up, and store
          // them locally so the next session keeps the same setup.
          if (peer.state.role === "host") {
            peer.updatePendingSettings({
              displayName: pendingPlayerSettings.displayName,
              color: pendingPlayerSettings.color,
              playerShape: pendingPlayerSettings.playerShape,
            });
            saveDisplayName(pendingPlayerSettings.displayName);
            savePreferences({
              color: pendingPlayerSettings.color,
              playerShape: pendingPlayerSettings.playerShape,
            });
          }
          setSettingsOpen(false);
        }}
      />
      <HelpDrawer inline isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
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

/**
 * The live line under a Quick Match search. The count is the honest answer to
 * "is anybody actually playing?", which is what someone who pressed a button
 * instead of typing a code is actually asking.
 */
function quickMatchDetail(
  playersOnline: number | undefined,
  queuePosition: number | null,
): string | undefined {
  const count =
    typeof playersOnline === "number"
      ? `${playersOnline} ${playersOnline === 1 ? "player" : "players"} online.`
      : "Checking how many players are online.";
  // The queue depth includes you, so "1 online" while you search is expected
  // and not a reason to bail. Say where you actually stand instead.
  return queuePosition != null ? `${count} You are number ${queuePosition} in the queue.` : count;
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
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
      >
        <Wifi className="size-3.5 text-[rgb(var(--player-color))]" aria-hidden="true" />
        Room ready
      </div>
      <p className="text-xs leading-tight text-muted-foreground">
        Send this code to your opponent; you start when they join.
      </p>
      <span
        className="glass-cell max-w-full break-all rounded-lg px-3 py-2 font-mono text-sm font-bold tracking-wide text-foreground sm:text-base"
      >
        <span className="sr-only">Room code </span>
        {roomId}
      </span>
      <div className="grid w-full gap-1.5 sm:flex sm:w-auto">
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("code", roomId)}
          className="w-full sm:w-auto"
        >
          <MorphIcon
            icon={copied === "code" ? CheckIcon : CopyIcon}
            className={`size-3.5 ${copied === "code" ? "text-emerald-500" : ""}`}
            aria-hidden="true"
          />
          Copy code
        </Button>
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("link", shareUrl)}
          className="w-full sm:w-auto"
        >
          <MorphIcon
            icon={copied === "link" ? CheckIcon : LinkIcon}
            className={`size-3.5 ${copied === "link" ? "text-emerald-500" : ""}`}
            aria-hidden="true"
          />
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
  detail,
  hint,
  cancelLabel,
  onCancel,
}: {
  message: string;
  detail?: string;
  /** Overrides the room-flavoured default. A Quick Match has no room to change. */
  hint?: string;
  cancelLabel?: string;
  onCancel: () => void;
}) {
  return (
    <div className="glass flex flex-col items-center gap-2 p-4">
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <Loader2 className="size-4 animate-spin text-[rgb(var(--player-color))]" aria-hidden="true" />
        {message}
      </span>
      {detail && (
        <p role="status" aria-live="polite" className="text-[11px] leading-tight text-muted-foreground">
          {detail}
        </p>
      )}
      <p className="text-[11px] leading-tight text-muted-foreground">
        {hint ?? "You can return to setup if you want to choose a different room."}
      </p>
      <Button size="sm" variant="glass" onClick={onCancel}>
        {cancelLabel ?? "Back to setup"}
      </Button>
    </div>
  );
}
