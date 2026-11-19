import { useCallback, useId, useMemo, useState } from "react";
import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  COLOR_RGB,
  Color,
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
  PlayerTypes,
  SymbolShape,
  oppositeColor,
  type AI_Difficulty as AI_DifficultyType,
  type GameMode,
  type GameSetup,
  type PlayerType,
  type TurnAction,
} from "@/game/constants";
import {
  MATCHMAKING_CONFIGURED,
  ONLINE_UNAVAILABLE,
} from "@/lib/matchmaking";
import { t, getDifficultyLabel, useStrings } from "@/i18n/language";
import { Card, CardContent } from "@/components/ui/card";
import { GameModeSelector } from "./gameModeSelector";
import {
  SettingsSheet,
  type SettingsTab,
  PlayerSummaryCard,
  OpponentSummaryCard,
  type PlayerSettings,
  type OpponentSettings,
} from "./playerSettingsSheet";
import { PreferencesSheet } from "./preferencesSheet";
import { LobbyCardFooter } from "./lobbyFormFooter";
import { LobbyCardHeader, OnlineMatchSection } from "./lobbyFormLayout";
import { getOrCreateGuestIdentity, sanitizeDisplayName, saveDisplayName } from "@/lib/identity";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { ROOM_ID_PATTERN, normalizeRoomId } from "@/lib/roomId";
import { usePlayerCount } from "@/hooks/usePlayerCount";
import { npcNameSession } from "@/game/npc-names";

/** The lobby's name for the app's launch configuration; declared once in
 *  game/constants.ts as `GameSetup` (it had been a byte-identical second
 *  declaration here, and App copied all eleven fields across by hand). */
export type LobbyFormPayload = GameSetup;

interface LobbyFormProps {
  initialRoomId?: string;
  onStart: (payload: LobbyFormPayload) => void;
  onReplayTutorial?: () => void;
}

const getRoomCodeError = (
  action: LobbyFormPayload["onlineAction"],
  roomId: string,
): string | null => {
  if (action === "join") {
    if (!roomId) return t("lobby.v.joinEmpty");
    if (!normalizeRoomId(roomId)) {
      return t("lobby.v.joinInvalid");
    }
  }
  // Check the RAW value: normalizeRoomId zeroes invalid codes, so
  // `roomId &&` swallowed every invalid non-empty code (e2e regression,
  // needs-work 10-02 P1 follow-through).
  if (action === "create" && roomId.trim() && !ROOM_ID_PATTERN.test(roomId.trim())) {
    return t("lobby.v.createInvalid");
  }
  return null;
};

const validate = (payload: LobbyFormPayload): string | null => {
  if (sanitizeDisplayName(payload.displayName) !== payload.displayName) {
    return t("lobby.v.name");
  }
  if (payload.gameMode === GameModes.VS_FRIEND && sanitizeDisplayName(payload.opponentName) !== payload.opponentName) {
    return t("lobby.v.opponentName");
  }
  if (!AVAILABLE_COLORS.includes(payload.color)) {
    return t("lobby.v.color");
  }
  if (!AVAILABLE_COLORS.includes(payload.opponentColor)) {
    return t("lobby.v.opponentColor");
  }
  if (payload.gameMode === GameModes.VS_FRIEND && payload.color === payload.opponentColor) {
    return t("lobby.v.distinct");
  }
  if (payload.gameMode === GameModes.ONLINE) {
    return getRoomCodeError(payload.onlineAction, payload.onlineRoomId.trim());
  }
  return null;
};

type SavedPreferences = ReturnType<typeof loadPreferences>;

const initialPlayerColor = (prefs: SavedPreferences): Color =>
  prefs.color ?? PLAYER_CONFIG[PlayerSymbol.X].defaultColor;

const initialPlayerShape = (prefs: SavedPreferences): SymbolShape =>
  prefs.playerShape ?? PLAYER_CONFIG[PlayerSymbol.X].defaultShape;

const initialOpponentColor = (prefs: SavedPreferences): Color => {
  const playerColor = initialPlayerColor(prefs);
  return prefs.opponentColor && prefs.opponentColor !== playerColor
    ? prefs.opponentColor
    : oppositeColor(playerColor);
};

const initialOpponentShape = (prefs: SavedPreferences): SymbolShape =>
  prefs.opponentShape ?? PLAYER_CONFIG[PlayerSymbol.O].defaultShape;

const initialAI_Difficulty = (prefs: SavedPreferences): AI_DifficultyType =>
  prefs.aiDifficulty ?? AI_Difficulty.NORMAL;

const initialOpponentName = (prefs: SavedPreferences, initialMode: GameMode): string =>
  // A saved name is the player's own choice; a fresh visitor meets a persona.
  // Online asks for a human opponent, so the persona is a Computer-mode
  // default only.
  prefs.opponentName ??
  (initialMode === GameModes.ONLINE ? t("lobby.defaultAI") : npcNameSession.pick(initialAI_Difficulty(prefs)));

// An invite link (?room=) asks for Online, but a build with no backend
// cannot honour it: fall back to Computer with the reason showing under
// the mode selector instead of stranding the visitor on a dead mode.
const initialGameMode = (roomId: string): GameMode =>
  roomId && !ONLINE_UNAVAILABLE ? GameModes.ONLINE : GameModes.VS_COMPUTER;

// Default to an action that can actually run: an invite opens Join,
// otherwise Quick, unless Quick itself is dead (dev without a
// matchmaking URL), in which case Create is the live default.
const initialOnlineAction = (roomId: string): TurnAction =>
  roomId && !ONLINE_UNAVAILABLE
    ? "join"
    : !MATCHMAKING_CONFIGURED
      ? "create"
      : "quick";

const quickMatchBlockReason = (): string | null =>
  !ONLINE_UNAVAILABLE && !MATCHMAKING_CONFIGURED ? t("lobby.quickUnavailable") : null;

// Online availability is decided up front, on the selectors, never on
// Start. A production build with no VITE_MATCHMAKING_URL cannot reach
// the relay either, so Quick, Create, and Join are all dead: the Online
// tile itself is disabled and says why (the tap used to escalate to the
// app-wide ErrorBoundary, or dial the visitor's own 127.0.0.1). Local
// dev still reaches a relay at its 127.0.0.1 default, so there only
// Quick Match, which needs the matchmaking service, is blocked.
// Proven-unreachable relay (never had a successful read) disables
// Online the same way a missing backend does. The build flag wins when
// both apply; unknown (poll in flight) stays enabled, never flickering.
const lobbyDisabledModes = (serverDown: boolean): Partial<Record<GameMode, string>> | undefined => {
  const onlineModeReason = ONLINE_UNAVAILABLE ? t("lobby.onlineModeUnavailable") : null;
  const serverDownReason =
    serverDown && !ONLINE_UNAVAILABLE ? t("lobby.onlineDown") : null;
  const onlineDisabledReason = onlineModeReason ?? serverDownReason;
  return onlineDisabledReason
    ? ({ [GameModes.ONLINE]: onlineDisabledReason } as Partial<Record<GameMode, string>>)
    : undefined;
};

const lobbyStartGate = ({
  payload,
  isValid,
  gameMode,
  onlineAction,
  onlineRoomId,
  quickMatchReason,
}: {
  payload: LobbyFormPayload;
  isValid: boolean;
  gameMode: GameMode;
  onlineAction: TurnAction;
  onlineRoomId: string;
  quickMatchReason: string | null;
}) => {
  const onlineUnavailable =
    gameMode === GameModes.ONLINE &&
    (ONLINE_UNAVAILABLE || (onlineAction === "quick" && !MATCHMAKING_CONFIGURED));
  const startDisabled = !isValid || onlineUnavailable;
  const startTitle = onlineUnavailable ? t("lobby.backendMissing") : undefined;
  // The room-code field already shows its own error inline; repeating it
  // under the button would say the same thing twice on one screen.
  const roomFieldError =
    gameMode === GameModes.ONLINE && onlineAction !== "quick" && onlineRoomId.trim()
      ? getRoomCodeError(onlineAction, onlineRoomId.trim())
      : null;
  const validationError = startDisabled ? validate(payload) : null;
  const startReason = onlineUnavailable
    ? (ONLINE_UNAVAILABLE ? t("lobby.backendMissing") : quickMatchReason)
    : validationError !== roomFieldError
      ? validationError
      : null;
  return { onlineUnavailable, startDisabled, startTitle, roomFieldError, startReason };
};

export function LobbyForm({ initialRoomId = "", onStart, onReplayTutorial }: LobbyFormProps) {
  // Subscribes so a language switch re-renders the whole form.
  useStrings();
  const {
    displayName,
    color,
    playerShape,
    opponentColor,
    opponentShape,
    gameMode,
    aiDifficulty,
    opponentName,
    opponentType,
    playerSettings,
    opponentSettings,
    handlePlayerSettingsChange,
    handleOpponentSettingsChange,
    handleGameModeChange,
    playerCount,
    serverDown,
  } = useLobbyPlayers(initialRoomId);
  const {
    onlineRoomId,
    setOnlineRoomId,
    onlineAction,
    explainedAction,
    actionDeadReason,
    chooseOnlineAction,
    quickMatchReason,
  } = useOnlineMatch(initialRoomId);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("player");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);

  const payload: LobbyFormPayload = useMemo(
    () => ({
      // Raw state, not pre-sanitized: the inputs now store the typed text via
      // filterDisplayNameInput, and validate() compares it against the
      // sanitized form. Sanitizing here would silently substitute a random
      // guest fallback for a too-short name and pass validation with a name
      // the user never typed.
      displayName,
      color,
      opponentColor,
      playerShape,
      opponentShape,
      gameMode,
      aiDifficulty,
      opponentName,
      opponentType,
      onlineRoomId: onlineRoomId.trim(),
      onlineAction,
    }),
    [
      displayName,
      color,
      opponentColor,
      playerShape,
      opponentShape,
      gameMode,
      aiDifficulty,
      opponentName,
      opponentType,
      onlineRoomId,
      onlineAction,
    ],
  );

  const isValid = useMemo(() => validate(payload) === null, [payload]);

  const disabledModes = lobbyDisabledModes(serverDown);
  const {
    onlineUnavailable,
    startDisabled,
    startTitle,
    roomFieldError,
    startReason,
  } = lobbyStartGate({
    payload,
    isValid,
    gameMode,
    onlineAction,
    onlineRoomId,
    quickMatchReason,
  });
  const startReasonId = useId();

  const startGame = useCallback(() => {
    const err = validate(payload);
    if (err) {
      setError(err);
      return false;
    }
    setError(null);
    saveDisplayName(payload.displayName);
    onStart(payload);
    return true;
  }, [payload, onStart]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      startGame();
    },
    [startGame],
  );

  const aiDifficultyLabel = getDifficultyLabel(aiDifficulty);

  return (
    <form
      onSubmit={handleSubmit}
      // Adaptive height. `max-h-full` + `my-auto` against the stretched app
      // wrapper means a short form centers at its natural size — no stretched
      // card wrapped around a void — while a tall one (Online adds the
      // match-type row and a room-code field) fills the phone and scrolls
      // instead of pushing Start below the fold.
      className="flex max-h-full w-full max-w-md flex-col max-sm:h-full max-sm:max-w-none sm:my-auto"
      style={{ "--player-color": COLOR_RGB[color] } as React.CSSProperties}
    >
      {/* On phones the glass panel is the screen itself: no floating border,
          radius or shadow. */}
      <Card
        variant="glass"
        className="lobby-screen-glass flex min-h-0 flex-1 flex-col gap-0 overflow-clip py-0 max-sm:rounded-none max-sm:border-0 max-sm:shadow-none"
      >
        <LobbyCardHeader onOpenPreferences={() => setPreferencesOpen(true)} />
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-0 sm:px-6">
          <div className="flex flex-col gap-3 sm:gap-3.5">
          {error && (
            <div
              role="alert"
              className="glass-cell rounded-lg border-destructive/30 px-3.5 py-2.5 text-sm text-destructive sm:text-xs"
            >
              {error}
            </div>
          )}

          <PlayerSummaryCard
            settings={playerSettings}
            onEdit={() => {
              setSettingsTab("player");
              setSettingsOpen(true);
            }}
          />

          {gameMode !== GameModes.ONLINE && (
            <OpponentSummaryCard
              opponentName={payload.opponentName}
              opponentColor={opponentColor}
              opponentShape={opponentShape}
              opponentType={opponentType}
              aiDifficultyLabel={aiDifficultyLabel}
              onEdit={() => {
                setSettingsTab("opponent");
                setSettingsOpen(true);
              }}
            />
          )}

          <GameModeSelector
            selectedMode={gameMode}
            onModeChange={handleGameModeChange}
            disabledModes={disabledModes}
          />

          {gameMode === GameModes.ONLINE && (
            <OnlineMatchSection
              playerCount={playerCount}
              onlineAction={onlineAction}
              explainedAction={explainedAction}
              onChooseAction={chooseOnlineAction}
              deadReason={actionDeadReason}
              onlineRoomId={onlineRoomId}
              onRoomIdChange={setOnlineRoomId}
              roomFieldError={roomFieldError}
            />
          )}
          </div>
        </CardContent>
        <LobbyCardFooter
          color={color}
          gameMode={gameMode}
          onlineAction={onlineAction}
          startDisabled={startDisabled}
          startTitle={startTitle}
          startReasonId={startReasonId}
          startReason={startReason}
          onlineUnavailable={onlineUnavailable}
        />
      </Card>

      <SettingsSheet
        isOpen={settingsOpen}
        gameMode={gameMode}
        tab={settingsTab}
        onTabChange={setSettingsTab}
        player={playerSettings}
        opponent={opponentSettings}
        onPlayerChange={handlePlayerSettingsChange}
        onOpponentChange={handleOpponentSettingsChange}
        onClose={() => setSettingsOpen(false)}
      />

      {/* App preferences: theme, language and the learning rows. A separate
          surface from the player form above, which is a setup task. */}
      <PreferencesSheet
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        onHowToPlay={() => {
          setPreferencesOpen(false);
          setHowToPlayOpen(true);
        }}
        onReplayTutorial={
          onReplayTutorial
            ? () => {
                setPreferencesOpen(false);
                onReplayTutorial();
              }
            : undefined
        }
      />

      <HelpDrawer
        isOpen={howToPlayOpen}
        onClose={() => setHowToPlayOpen(false)}
        onReplayTutorial={onReplayTutorial}
      />
    </form>
  );
}

function useLobbyPlayers(initialRoomId: string) {
  // Appearance + opponent picks persist across sessions (tic-tac-toe:preferences).
  const [initialPrefs] = useState(loadPreferences);
  const [displayName, setDisplayName] = useState<string>(
    () => getOrCreateGuestIdentity().displayName,
  );
  const [color, setColor] = useState<Color>(() => initialPlayerColor(initialPrefs));
  const [playerShape, setPlayerShape] = useState<SymbolShape>(() => initialPlayerShape(initialPrefs));
  const [opponentColor, setOpponentColor] = useState<Color>(() => initialOpponentColor(initialPrefs));
  const [opponentShape, setOpponentShape] = useState<SymbolShape>(() => initialOpponentShape(initialPrefs));
  const [gameMode, setGameMode] = useState<GameMode>(() => initialGameMode(initialRoomId));
  const [aiDifficulty, setAI_Difficulty] = useState<AI_DifficultyType>(() => initialAI_Difficulty(initialPrefs));
  const [opponentName, setOpponentName] = useState<string>(() =>
    initialOpponentName(initialPrefs, initialGameMode(initialRoomId)),
  );
  const [opponentType, setOpponentType] = useState<PlayerType>(PlayerTypes.COMPUTER);

  // Live Online population, plus reachability. Subscribed whenever the
  // lobby is up (not only in Online mode): answering "is anyone playing?"
  // before Quick Match is pressed is the whole point, and a missing relay
  // must read as unreachable on arrival instead of silently enabled tiles.
  const { count: playerCount, serverDown } = usePlayerCount(true, undefined, true);

  const playerSettings: PlayerSettings = useMemo(
    () => ({ displayName, color, playerShape }),
    [displayName, color, playerShape],
  );

  const opponentSettings: OpponentSettings = useMemo(
    () => ({ opponentName, opponentColor, opponentShape, opponentType, aiDifficulty }),
    [opponentName, opponentColor, opponentShape, opponentType, aiDifficulty],
  );

  const handlePlayerSettingsChange = useCallback(
    (next: PlayerSettings) => {
      setDisplayName(next.displayName);
      setColor(next.color);
      setPlayerShape(next.playerShape);
      saveDisplayName(next.displayName);
      // Keep opponent color opposite in non-friend modes; in VS Friend the
      // opponent sheet owns the opponent color and ensures distinctness.
      const derivedOpponent =
        gameMode !== GameModes.VS_FRIEND ? oppositeColor(next.color) : undefined;
      if (derivedOpponent) setOpponentColor(derivedOpponent);
      savePreferences({
        color: next.color,
        playerShape: next.playerShape,
        ...(derivedOpponent ? { opponentColor: derivedOpponent } : {}),
      });
    },
    [gameMode],
  );

  const handleOpponentSettingsChange = useCallback(
    (next: OpponentSettings) => {
      setOpponentName(next.opponentName);
      setOpponentType(next.opponentType);
      setAI_Difficulty(next.aiDifficulty);
      setOpponentShape(next.opponentShape);
      // If the opponent picks the user's color, swap so they stay distinct:
      // the user takes the opponent's previous color, the opponent gets the pick.
      const playerColor = next.opponentColor === color ? opponentColor : color;
      if (next.opponentColor === color) setColor(opponentColor);
      setOpponentColor(next.opponentColor);
      savePreferences({
        color: playerColor,
        opponentColor: next.opponentColor,
        opponentName: next.opponentName,
        opponentShape: next.opponentShape,
        aiDifficulty: next.aiDifficulty,
      });
    },
    [color, opponentColor],
  );

  const handleGameModeChange = useCallback(
    (nextMode: GameMode) => {
      setGameMode(nextMode);
      if (nextMode === GameModes.VS_COMPUTER) {
        setOpponentColor(oppositeColor(color));
        // A fresh persona each time Computer mode is entered — the session's
        // draw pile guarantees it differs from the last name shown.
        setOpponentName(npcNameSession.pick(aiDifficulty));
        setOpponentType(PlayerTypes.COMPUTER);
      } else if (nextMode === GameModes.VS_FRIEND) {
        // Hydrate the last saved opponent name so Friend mode reopens with it.
        // An empty or invalid saved name used to leave Start permanently
        // disabled with no visible reason, so fall back to a valid default.
        const saved = loadPreferences().opponentName;
        setOpponentName(saved && sanitizeDisplayName(saved) === saved ? saved : t("lobby.defaultPlayer2"));
        setOpponentType(PlayerTypes.HUMAN);
      }
    },
    [color, aiDifficulty],
  );

  // A picked Online that proves unreachable falls back to Computer with
  // the reason showing, instead of stranding a dead mode. Render-phase
  // adjustment, not an effect: the condition is false on the re-render, so
  // there is no cascade (the set-state-in-effect lint rule bans the
  // effect form of exactly this). Mirrors handleGameModeChange's Computer
  // branch: opponent returns to the AI trio.
  if (serverDown && !ONLINE_UNAVAILABLE && gameMode === GameModes.ONLINE) {
    setGameMode(GameModes.VS_COMPUTER);
    setOpponentColor(oppositeColor(color));
    setOpponentName(npcNameSession.pick(aiDifficulty));
    setOpponentType(PlayerTypes.COMPUTER);
  }

  return {
    displayName,
    color,
    playerShape,
    opponentColor,
    opponentShape,
    gameMode,
    aiDifficulty,
    opponentName,
    opponentType,
    playerSettings,
    opponentSettings,
    handlePlayerSettingsChange,
    handleOpponentSettingsChange,
    handleGameModeChange,
    playerCount,
    serverDown,
  };
}

function useOnlineMatch(initialRoomId: string) {
  const [onlineRoomId, setOnlineRoomId] = useState<string>(initialRoomId);
  // Which dead match-type tile the visitor tapped: its reason shows on
  // demand. Picking a live action clears it.
  const [explainedAction, setExplainedAction] = useState<TurnAction | null>(
    null,
  );
  const [onlineAction, setOnlineAction] = useState<TurnAction>(() =>
    initialOnlineAction(initialRoomId),
  );

  const quickMatchReason = quickMatchBlockReason();
  const actionDeadReason = (action: TurnAction): string | null =>
    action === "quick"
      ? quickMatchReason
      : ONLINE_UNAVAILABLE
        ? t("lobby.backendMissing")
        : null;
  const chooseOnlineAction = (action: TurnAction) => {
    const dead = actionDeadReason(action);
    if (dead) {
      setExplainedAction((cur) => (cur === action ? null : action));
    } else {
      setExplainedAction(null);
      setOnlineAction(action);
    }
  };

  return {
    onlineRoomId,
    setOnlineRoomId,
    onlineAction,
    explainedAction,
    actionDeadReason,
    chooseOnlineAction,
    quickMatchReason,
  };
}
