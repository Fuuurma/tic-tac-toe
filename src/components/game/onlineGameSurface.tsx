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
import { OnlineConnectionBanners } from "./onlineConnectionBanners";

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
      <OnlineConnectionBanners
        state={peer.state}
        action={config.onlineAction}
        waiting={playerCount?.waiting}
        actions={{
          cancel: () => {
            peer.leave();
            onExit();
          },
          exit: onExit,
          retry: peer.retryReconnect,
          retryQuickMatch: () => {
            void peer.startQuickMatch();
          },
        }}
      />

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
