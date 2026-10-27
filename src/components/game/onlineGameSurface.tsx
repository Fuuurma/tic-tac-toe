import { SocialReactions } from "./socialReactions";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AI_Difficulty,
  type AI_Difficulty as AI_DifficultyType,
  Color,
  GameModes,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
  type TurnAction,
} from "@/game/constants";
import { COPY_FLASH_MS, GameStatus } from "@/game/constants";
import { Board } from "./board";
import { PlayersPanel } from "./playersPanel";
import { Button } from "@/components/ui/button";
import { usePeerRoom, type PeerStatus } from "@/hooks/usePeerRoom";
import { usePlayerCount } from "@/hooks/usePlayerCount";
import { useGameStats } from "@/hooks/useGameStats";
import { saveDisplayName } from "@/lib/identity";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import {
  SettingsSheet,
  type PlayerSettings,
} from "@/components/lobby/playerSettingsSheet";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { QueueStrip, QueueWarmup, WarmupInvite } from "./queuePlay";
import { waitPhase } from "./waitPhase";
import { Check as CheckIcon, Copy as CopyIcon, Link2 as LinkIcon } from "lucide";
import { Loader2, Share2, Wifi } from "lucide-react";
import { MorphIcon } from "morphicons/react";
import { t, useStrings } from "@/i18n/language";

interface OnlineGameSurfaceProps {
  config: {
    displayName: string;
    color: Color;
    playerShape: SymbolShape;
    gameMode: typeof GameModes.ONLINE;
    onlineRoomId: string;
    onlineAction: TurnAction;
  };
  onExit: () => void;
}

export function OnlineGameSurface({ config, onExit }: OnlineGameSurfaceProps) {
  // Subscribes so a language switch re-renders banners and panels.
  useStrings();
  const peer = usePeerRoom({
    hostDisplayName: config.displayName,
    hostColor: config.color,
    hostShape: config.playerShape,
    gameMode: GameModes.ONLINE,
  });
  const isQuick = config.onlineAction === "quick";
  const isCreate = config.onlineAction === "create";
  // Only the searching state needs the live count, and only Quick Match has
  // a searching state worth watching. `queue` says "still in line"; `status`
  // cannot, since a paired host building its room holds `creating` too.
  const { count: playerCount } = usePlayerCount(isQuick && peer.state.queue === "searching");

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
  const gameStatusShowsGame = ["connected", "reconnecting", "disconnected"].includes(
    peer.state.status,
  );

  // The wait before the online game exists: in the Quick Match queue or in an
  // open room, paired and being connected, or over. The cards, the strip and
  // the handoff all key on this, never on message copy.
  const phase = waitPhase({
    action: config.onlineAction,
    role: peer.state.role,
    status: peer.state.status,
    queue: peer.state.queue,
    gameStatus: peer.state.gameState.gameStatus,
  });
  // The player's choice to fill the wait with a game against the computer.
  // The game lives while the wait does, and goes the moment the real board
  // replaces it (phase turns null once the match connects).
  const [warmupOpen, setWarmupOpen] = useState(false);
  const warmupVisible = warmupOpen && phase !== null;
  // A host's room can blip into `reconnecting` while the warm-up is on
  // screen; the empty online board must not appear beside it.
  const showGame = gameStatusShowsGame && !warmupVisible;
  const [warmupDifficulty, setWarmupDifficulty] = useState<AI_DifficultyType>(
    () => loadPreferences().aiDifficulty ?? AI_Difficulty.NORMAL,
  );
  const leaveAndExit = () => {
    peer.leave();
    onExit();
  };
  const shareUrl = roomShareUrl(
    typeof window !== "undefined" ? window.location.origin : "",
    peer.state.roomId,
  );
  const warmupInvite = (
    <WarmupInvite
      difficulty={warmupDifficulty}
      color={config.color}
      onDifficultyChange={(next) => {
        setWarmupDifficulty(next);
        savePreferences({ aiDifficulty: next });
      }}
      onStart={() => setWarmupOpen(true)}
    />
  );

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
    // Phones: the column fills the screen and the HUD dissolves into it
    // (PlayersPanel `max-sm:contents`), so `order` stacks status, players,
    // banners, board, then the action bar. Banners sit directly above the
    // board; with no game yet they are the only content and centre.
    <div className="relative flex w-full max-w-md flex-col items-stretch gap-2 max-sm:h-full max-sm:max-w-none max-sm:justify-center sm:gap-3">
      <div className="flex flex-col gap-2 empty:hidden max-sm:order-4 max-sm:px-4">
        {/* Status banners — always on top so the user sees them first.
            A room code is an invitation token for a specific person, so it
            belongs to "create a room" only. Quick match is paired by the
            service; surfacing its internal room id would hand out a join key
            for a match nobody asked to be in. */}
        {peer.state.status === "waiting" && isCreate && !warmupVisible && (
          <>
            <RoomIdShare
              roomId={peer.state.roomId}
              shareUrl={shareUrl}
              onCancel={leaveAndExit}
            />
            <div className="glass flex flex-col items-center gap-2 p-3 max-sm:gap-3 max-sm:p-5">
              {warmupInvite}
              <p className="text-[11px] leading-tight text-muted-foreground max-sm:text-center max-sm:text-sm">
                {t("queue.roomKept")}
              </p>
            </div>
          </>
        )}
        {isQuick && phase === "searching" && !warmupVisible && (
          <OnlineConnectionState
            message={t("online.finding")}
            detail={quickMatchDetail(playerCount?.waiting)}
            hint={t("queue.keepSpot")}
            cancelLabel={t("online.cancelSearch")}
            onCancel={leaveAndExit}
          >
            {warmupInvite}
          </OnlineConnectionState>
        )}
        {isQuick && phase === "matched" && !warmupVisible && (
          <OnlineConnectionState
            message={t("queue.matchedTitle")}
            hint={t("queue.matchedBody")}
            cancelLabel={t("queue.cancel")}
            onCancel={leaveAndExit}
          />
        )}
        {warmupVisible && phase !== null && (
          <QueueStrip
            phase={phase}
            detail={isQuick ? quickStripDetail(playerCount?.waiting) : undefined}
            message={peer.state.message || t("online.connectFail")}
            title={isQuick ? undefined : t("queue.roomWaiting")}
            leaveLabel={isQuick ? undefined : t("queue.closeRoom")}
            invite={
              isQuick
                ? undefined
                : {
                    url: shareUrl,
                    shareTitle: t("online.shareTitle"),
                    shareText: t("online.shareText", { code: peer.state.roomId }),
                  }
            }
            onLeave={leaveAndExit}
            // Only a search can be run again; a closed room is made from setup.
            onSearchAgain={
              isQuick
                ? () => {
                    void peer.startQuickMatch();
                  }
                : undefined
            }
          />
        )}
        {peer.state.status === "creating" && !isQuick && (
          <OnlineConnectionState
            message={t("online.creating")}
            onCancel={leaveAndExit}
          />
        )}
        {peer.state.status === "connecting" && !warmupVisible && (!isQuick || phase === null) && (
          <OnlineConnectionState
            // relayEvents already writes the accurate reason here ("Waiting
            // for host…", a relay rejection, a room-not-found). A hardcoded
            // string threw it away, so a join that fails for a knowable
            // reason spun on "Joining room…" indefinitely with no way to tell
            // a slow host from a dead room.
            message={peer.state.message || t("online.joining")}
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
              {peer.state.message || t("online.reconnecting")}
            </span>
            <span className="text-[11px] text-muted-foreground max-sm:text-xs">
              {t("online.roomOpen")}
            </span>
            <Button
              size="sm"
              variant="glass"
              onClick={() => peer.retryReconnect()}
              className="w-full sm:w-auto max-sm:h-12"
            >
              {t("online.retry")}
            </Button>
          </div>
        )}
        {peer.state.status === "error" && !warmupVisible && (
          <div
            role="alert"
            className="glass flex w-full flex-col items-center gap-2 border-destructive/30 bg-destructive/15 px-3 py-2"
          >
            <span className="text-xs text-destructive">
              {peer.state.message || t("online.connectFail")}
            </span>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
              {config.onlineAction === "quick" && (
                <Button
                  size="sm"
                  variant="glass"
                  onClick={() => {
                    void peer.startQuickMatch();
                  }}
                  className="w-full sm:w-auto max-sm:h-12"
                >
                  {t("online.tryAgain")}
                </Button>
              )}
              <Button
                size="sm"
                variant="glass"
                onClick={onExit}
                className="w-full sm:w-auto max-sm:h-12"
              >
                {t("online.backSetup")}
              </Button>
            </div>
          </div>
        )}
        {peer.state.status === "disconnected" && peer.state.message && !warmupVisible && (
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
              className="w-full sm:w-auto max-sm:h-12"
            >
              {t("online.backSetup")}
            </Button>
          </div>
        )}

      </div>

      {warmupVisible && (
        <QueueWarmup
          player={{
            displayName: config.displayName,
            color: config.color,
            playerShape: config.playerShape,
          }}
          difficulty={warmupDifficulty}
          handoff={phase === "matched"}
          handoffTitle={isQuick ? undefined : t("queue.joinedTitle")}
          onStop={() => setWarmupOpen(false)}
        />
      )}

      {/* Game area — below the status banners */}
      {showGame && (
        <>
          <SocialReactions ready={peer.state.status === "connected"} reaction={peer.reaction} send={peer.sendReaction} />
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

          <div className="flex min-h-0 flex-1 flex-col justify-center max-sm:order-5">
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
                  ? t("app.boardPaused")
                  : peer.state.status !== "connected"
                    ? t("game.notConnected")
                    : peer.state.gameState.currentPlayer !== localSymbol
                      ? t("game.waitingOpponent")
                      : peer.state.gameState.gameStatus !== "ACTIVE"
                        ? t("app.boardGameOver")
                        : undefined
              }
              showVanish
              onCellClick={peer.sendMove}
            />
          </div>
        </>
      )}
      <SettingsSheet
        isOpen={settingsOpen && peer.state.role === "host"}
        gameMode={GameModes.ONLINE}
        tab="player"
        onTabChange={() => undefined}
        player={pendingPlayerSettings}
        opponent={{
          opponentName: t("settings.opponentFallback"),
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
  if (status === "creating") return t("online.findingMatch");
  if (status === "waiting") return t("online.waitingOpponent");
  if (status === "connecting") return t("online.connecting");
  if (status === "reconnecting") return fallback || t("online.reconnecting");
  if (status === "error") return fallback;
  return fallback;
}

/**
 * The live line under a Quick Match search.
 *
 * This reports the QUEUE, not the lobby's "players online", because the
 * queue includes the person reading it: "0 players online" while you are the
 * one searching is self-contradictory, and the number you actually want is
 * how many OTHER people you can be paired with right now. So count the rest
 * of the queue, and say so plainly when you are first — which is a real,
 * reassuring state rather than a failure.
 */
function quickMatchDetail(waiting: number | undefined): string {
  if (waiting === undefined) return t("online.queueCheck");
  // The health read can also land before the join has registered, in which
  // case `waiting` undercounts by one — the same "you're first" copy is the
  // right answer either way, and the next poll corrects it.
  const others = Math.max(0, waiting - 1);
  if (others === 0) {
    return t("online.queueFirst");
  }
  return others === 1
    ? t("online.queueOne", { count: others })
    : t("online.queueMany", { count: others });
}

/** The same queue read as `quickMatchDetail`, short enough for the strip. */
function quickStripDetail(waiting: number | undefined): string {
  if (waiting === undefined) return t("queue.stripCheck");
  const others = Math.max(0, waiting - 1);
  if (others === 0) return t("queue.stripFirst");
  return others === 1
    ? t("queue.stripOne", { count: others })
    : t("queue.stripMany", { count: others });
}

/** The link that opens the lobby straight into this room. */
function roomShareUrl(origin: string, roomId: string): string {
  return origin ? `${origin}/?room=${roomId}` : roomId;
}

function RoomIdShare({
  roomId,
  shareUrl,
  onCancel,
}: {
  roomId: string;
  shareUrl: string;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [copyError, setCopyError] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onCopy = async (kind: "code" | "link", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(false);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), COPY_FLASH_MS);
    } catch {
      setCopyError(true);
    }
  };

  const onShare = async () => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: t("online.shareTitle"),
        text: t("online.shareText", { code: roomId }),
        url: shareUrl,
      });
    } catch {
      // The user may cancel the native share sheet; no error is needed.
    }
  };

  return (
    <div className="glass flex w-full flex-col items-center gap-2 p-3 max-sm:gap-3 max-sm:p-5">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground max-sm:text-lg"
      >
        <Wifi className="size-3.5 text-[rgb(var(--player-color))] max-sm:size-5" aria-hidden="true" />
        {t("online.roomReady")}
      </div>
      <p className="text-xs leading-tight text-muted-foreground max-sm:text-center max-sm:text-sm">
        {t("online.sendCode")}
      </p>
      <span
        className="glass-cell max-w-full break-all rounded-lg px-3 py-2 font-mono text-sm font-bold tracking-wide text-foreground sm:text-base"
      >
        <span className="sr-only">{t("online.roomCodeSr")}</span>
        {roomId}
      </span>
      <div className="grid w-full gap-1.5 max-sm:gap-2 sm:flex sm:w-auto">
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("code", roomId)}
          className="w-full sm:w-auto max-sm:h-12"
        >
          <MorphIcon
            icon={copied === "code" ? CheckIcon : CopyIcon}
            className={`size-3.5 ${copied === "code" ? "text-emerald-500" : ""}`}
            aria-hidden="true"
          />
          {t("online.copyCode")}
        </Button>
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("link", shareUrl)}
          className="w-full sm:w-auto max-sm:h-12"
        >
          <MorphIcon
            icon={copied === "link" ? CheckIcon : LinkIcon}
            className={`size-3.5 ${copied === "link" ? "text-emerald-500" : ""}`}
            aria-hidden="true"
          />
          {t("online.copyLink")}
        </Button>
        {canShare && (
          // A phone's own share sheet (Messages, WhatsApp…) is the natural
          // way to invite someone, so it leads the list there.
          <Button size="sm" variant="glass" onClick={onShare} className="w-full max-sm:order-first max-sm:h-12 max-sm:text-base max-sm:font-semibold sm:w-auto">
            <Share2 className="size-3.5" aria-hidden="true" />
            {t("online.share")}
          </Button>
        )}
        <Button
          size="sm"
          variant="glass"
          onClick={onCancel}
          className="w-full sm:w-auto max-sm:h-12"
        >
          {t("online.backSetup")}
        </Button>
      </div>
      {copied && (
        <span role="status" aria-live="polite" className="text-xs text-emerald-600 dark:text-emerald-400">
          {copied === "code" ? t("online.codeCopied") : t("online.linkCopied")}
        </span>
      )}
      {copyError && (
        <span role="status" aria-live="polite" className="text-xs text-destructive">
          {t("online.copyFail")}
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
  children,
}: {
  message: string;
  detail?: string;
  /** An offer to make the wait useful, shown between the status and the exit. */
  children?: ReactNode;
  /** Overrides the room-flavoured default. A Quick Match has no room to change. */
  hint?: string;
  cancelLabel?: string;
  onCancel: () => void;
}) {
  return (
    <div className="glass flex flex-col items-center gap-2 p-4 max-sm:gap-3 max-sm:p-6">
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground max-sm:text-base"
      >
        <Loader2 className="size-4 animate-spin text-[rgb(var(--player-color))]" aria-hidden="true" />
        {message}
      </span>
      {detail && (
        <p role="status" aria-live="polite" className="text-[11px] leading-tight text-muted-foreground max-sm:text-center max-sm:text-sm">
          {detail}
        </p>
      )}
      {children}
      <p className="text-[11px] leading-tight text-muted-foreground max-sm:text-center max-sm:text-sm">
        {hint ?? t("online.setupHint")}
      </p>
      <Button size="sm" variant="glass" onClick={onCancel} className="w-full sm:w-auto max-sm:h-12">
        {cancelLabel ?? t("online.backSetup")}
      </Button>
    </div>
  );
}
