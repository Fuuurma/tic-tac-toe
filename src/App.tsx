import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "@/components/errorBoundary";
import { GameModes, type GameSetup } from "@/game/constants";

import { LobbyForm, type LobbyFormPayload } from "@/components/lobby/lobbyForm";
import { OnboardingFlow } from "@/components/onboarding/onboardingFlow";
import { BackgroundPattern } from "@/components/backgroundPattern";
import { LocalBoard } from "@/components/game/localBoard";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { PlayersPanel } from "@/components/game/playersPanel";
import { PreferencesSheet } from "@/components/lobby/preferencesSheet";
import {
  SettingsSheet,
  type OpponentSettings,
  type PlayerSettings,
  type SettingsTab,
} from "@/components/lobby/playerSettingsSheet";
import { useLocalGame } from "@/hooks/useLocalGame";
import { useGameStats } from "@/hooks/useGameStats";
import { useRecordLocalResult } from "@/hooks/useRecordLocalResult";
import { normalizeRoomId } from "@/lib/roomId";
import { saveDisplayName } from "@/lib/identity";
import { shouldShowOnboarding } from "@/lib/onboarding";
import { savePreferences } from "@/lib/preferences";
import { t } from "@/i18n/language";

const OnlineGameSurface = lazy(() =>
  import("./components/game/onlineGameSurface").then((m) => ({ default: m.OnlineGameSurface })),
);

type View = "onboarding" | "lobby" | "game";



export default function App() {
  const [initialRoomId] = useState(() => {
    if (typeof window === "undefined") return "";
    return normalizeRoomId(new URLSearchParams(window.location.search).get("room"));
  });
  // Decided once, before anything below can create an identity. Someone
  // arriving on an invite link came to join a room, not to be walked through
  // the game; they can replay the tutorial from the lobby's help.
  const [view, setView] = useState<View>(() =>
    !initialRoomId && shouldShowOnboarding() ? "onboarding" : "lobby",
  );
  const [onboardingMode, setOnboardingMode] = useState<"first-run" | "replay">("first-run");
  const [config, setConfig] = useState<GameSetup | null>(null);

  const handleStart = (payload: LobbyFormPayload) => {
    // `LobbyFormPayload` IS `GameSetup`, so there is nothing to copy across —
    // the eleven-field copy that used to live here is what let the two
    // declarations drift apart.
    setConfig(payload);
    setView("game");
    if (payload.onlineRoomId && typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const handleExit = () => {
    setView("lobby");
    setConfig(null);
  };

  return (
    <main id="main-content" className="relative isolate flex h-dvh w-full items-stretch justify-center overflow-y-auto bg-[image:var(--gradient-light)] dark:bg-[image:var(--gradient-dark)] sm:items-center">
      {/* Living symbol field: canvas layer above the gradient base */}
      <BackgroundPattern />
      {/* Keep the dark scrim below the board; leave the light symbol field clear. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] dark:bg-[image:var(--bg-mask-dark)] dark:max-sm:bg-[image:var(--bg-mask-dark-phone)]"
      />
      {/* Below `sm` this wrapper stretches to the full scrollport so the
          phone game column can take the full height and centre the board in
          what remains. From `sm` up, auto margins restore content-height
          centring for desktop. */}
      <div className="relative z-10 flex w-full justify-center sm:my-auto">
        {view === "onboarding" && (
          <OnboardingFlow mode={onboardingMode} onExit={() => setView("lobby")} />
        )}
        {view === "lobby" && (
          <LobbyForm
            initialRoomId={initialRoomId}
            onStart={handleStart}
            onReplayTutorial={() => {
              setOnboardingMode("replay");
              setView("onboarding");
            }}
          />
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

function GameView({ config, onExit }: { config: GameSetup; onExit: () => void }) {
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
  config: GameSetup;
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
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("player");
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  // Settings edits made mid-game persist like lobby edits do, so the next
  // match reopens with the same setup.
  const handlePlayerSettingsChange = useCallback((next: PlayerSettings) => {
    setPlayerSettings(next);
    saveDisplayName(next.displayName);
    savePreferences({ color: next.color, playerShape: next.playerShape });
  }, []);
  const handleOpponentSettingsChange = useCallback((next: OpponentSettings) => {
    setOpponentSettings(next);
    savePreferences({
      opponentName: next.opponentName,
      opponentColor: next.opponentColor,
      opponentShape: next.opponentShape,
      aiDifficulty: next.aiDifficulty,
    });
  }, []);

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
  // The local game's status line renders from `gameState.turnNotice` (see
  // the StatusLine below), so the hook returns no message of its own.
  const { gameState, humanSymbol, handleCellClick, handleReset, exit, setPaused, paused } = useLocalGame(input);
  const gameStats = useGameStats();
  const { stats } = gameStats;
  useRecordLocalResult(gameState, humanSymbol, gameStats);
  const [panelPaused, setPanelPaused] = useState(false);

  useEffect(() => {
    setPaused(settingsOpen || preferencesOpen || howToPlayOpen || panelPaused);
  }, [settingsOpen, preferencesOpen, howToPlayOpen, panelPaused, setPaused]);

  return (
    // Portrait stacks HUD above board. A short landscape phone (~667x375)
    // cannot: stacking leaves the board wider than the screen is tall, so
    // the player scrolls to find the bottom row against a 10s clock. Once
    // the viewport is wider than it is tall the column lays out side by
    // side instead, which is the wide axis finally being used.
    <div className="relative flex h-full w-full max-w-md flex-col items-stretch gap-2 sm:h-auto sm:gap-3 landscape-short:max-w-3xl landscape-short:flex-row landscape-short:items-start">
      <div className="max-sm:contents landscape-short:min-w-0 landscape-short:flex-1">
        <PlayersPanel
          gameState={gameState}
          stats={stats}
          gameMode={config.gameMode}
          // F578, same contract as the stats context above: the card shows
          // the tier the running game was created at, not the live selection.
          aiDifficulty={
            config.gameMode === GameModes.VS_COMPUTER
              ? gameState.aiDifficulty
              : undefined
          }
          message={gameState.turnNotice ?? ""}
          onNewGame={handleReset}
          onExit={() => {
            exit();
            onExit();
          }}
          onOpenSettings={() => setPreferencesOpen(true)}
          onEditIdentity={() => {
            setSettingsTab("player");
            setSettingsOpen(true);
          }}
          onPauseChange={(panelPause) => {
            setPanelPaused(panelPause);
            setPaused(settingsOpen || preferencesOpen || howToPlayOpen || panelPause);
          }}
          paused={paused}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center max-sm:order-5 landscape-short:min-w-0 landscape-short:flex-1">
        <LocalBoard gameState={gameState} paused={paused} onCellClick={handleCellClick} />
      </div>
      <HelpDrawer
        inline
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
      />
      <SettingsSheet
        isOpen={settingsOpen}
        gameMode={config.gameMode as typeof GameModes.VS_COMPUTER | typeof GameModes.VS_FRIEND}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        player={playerSettings}
        opponent={opponentSettings}
        onPlayerChange={handlePlayerSettingsChange}
        onOpponentChange={handleOpponentSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />

      <PreferencesSheet
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        onHowToPlay={() => {
          setPreferencesOpen(false);
          setHowToPlayOpen(true);
        }}
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
        className="glass-well relative mx-auto aspect-square w-full rounded-2xl p-2.5 sm:p-3.5"
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
            {t("app.loading")}
          </span>
        </div>
      </div>
    </div>
  );
}
