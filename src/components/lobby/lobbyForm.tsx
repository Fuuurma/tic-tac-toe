import { useCallback, useId, useMemo, useState } from "react";
import {
  AI_Difficulty,
  AI_DIFFICULTY_LABELS,
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
  type PlayerType,
} from "@/game/constants";
import {
  MATCHMAKING_CONFIGURED,
  MATCHMAKING_UNAVAILABLE_MESSAGE,
} from "@/lib/matchmaking";
import { Card, CardHeader } from "@/components/ui/card";
import { GameMark } from "./gameMark";
import {
  SettingsSheet,
  type SettingsTab,
  type PlayerSettings,
  type OpponentSettings,
} from "./playerSettingsSheet";
import { CircleHelp } from "lucide-react";
import { getOrCreateGuestIdentity, sanitizeDisplayName, saveDisplayName } from "@/lib/identity";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { ROOM_ID_PATTERN, normalizeRoomId } from "@/lib/roomId";
import { usePlayerCount } from "@/hooks/usePlayerCount";
import {
  LobbyContent,
  LobbyStartFooter,
  type OnlineAction,
} from "./lobbyFormLayout";

export interface LobbyFormPayload {
  displayName: string;
  color: Color;
  opponentColor: Color;
  playerShape: SymbolShape;
  opponentShape: SymbolShape;
  gameMode: GameMode;
  aiDifficulty: AI_DifficultyType;
  opponentName: string;
  opponentType: PlayerType;
  onlineRoomId: string;
  onlineAction: OnlineAction;
}

interface LobbyFormProps {
  initialRoomId?: string;
  onStart: (payload: LobbyFormPayload) => void;
}

const getRoomCodeError = (
  action: LobbyFormPayload["onlineAction"],
  roomId: string,
): string | null => {
  if (action === "join") {
    if (!roomId) return "Enter a room code to join.";
    if (!normalizeRoomId(roomId)) {
      return "Room code must be 4-64 letters, digits, hyphens, or underscores.";
    }
  }
  // Check the RAW value: normalizeRoomId zeroes invalid codes, so
  // `roomId &&` swallowed every invalid non-empty code (e2e regression,
  // needs-work 10-02 P1 follow-through).
  if (action === "create" && roomId.trim() && !ROOM_ID_PATTERN.test(roomId.trim())) {
    return "Custom room code must be 4–64 letters, digits, hyphens, or underscores.";
  }
  return null;
};

const validate = (payload: LobbyFormPayload): string | null => {
  if (sanitizeDisplayName(payload.displayName) !== payload.displayName) {
    return "Enter a valid name (2-20 characters, no control characters).";
  }
  if (payload.gameMode === GameModes.VS_FRIEND && sanitizeDisplayName(payload.opponentName) !== payload.opponentName) {
    return "Enter a valid opponent name (2-20 characters, no control characters).";
  }
  if (!AVAILABLE_COLORS.includes(payload.color)) {
    return "Pick a color.";
  }
  if (!AVAILABLE_COLORS.includes(payload.opponentColor)) {
    return "Pick an opponent color.";
  }
  if (payload.gameMode === GameModes.VS_FRIEND && payload.color === payload.opponentColor) {
    return "Choose different colors for both players.";
  }
  if (payload.gameMode === GameModes.ONLINE) {
    return getRoomCodeError(payload.onlineAction, payload.onlineRoomId.trim());
  }
  return null;
};

export function LobbyForm({ initialRoomId = "", onStart }: LobbyFormProps) {
  const [displayName, setDisplayName] = useState<string>(
    () => getOrCreateGuestIdentity().displayName,
  );
  // Appearance + opponent picks persist across sessions (tic-tac-toe:preferences).
  const [initialPrefs] = useState(loadPreferences);
  const [color, setColor] = useState<Color>(
    initialPrefs.color ?? PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
  );
  const [playerShape, setPlayerShape] = useState<SymbolShape>(
    initialPrefs.playerShape ?? PLAYER_CONFIG[PlayerSymbol.X].defaultShape,
  );
  const [opponentColor, setOpponentColor] = useState<Color>(() => {
    const playerColor = initialPrefs.color ?? PLAYER_CONFIG[PlayerSymbol.X].defaultColor;
    return initialPrefs.opponentColor && initialPrefs.opponentColor !== playerColor
      ? initialPrefs.opponentColor
      : oppositeColor(playerColor);
  });
  const [opponentShape, setOpponentShape] = useState<SymbolShape>(
    initialPrefs.opponentShape ?? PLAYER_CONFIG[PlayerSymbol.O].defaultShape,
  );
  const [gameMode, setGameMode] = useState<GameMode>(
    initialRoomId ? GameModes.ONLINE : GameModes.VS_COMPUTER,
  );
  const [aiDifficulty, setAI_Difficulty] = useState<AI_DifficultyType>(
    initialPrefs.aiDifficulty ?? AI_Difficulty.NORMAL,
  );
  const [opponentName, setOpponentName] = useState<string>(
    initialPrefs.opponentName ?? "AI",
  );
  const [opponentType, setOpponentType] = useState<PlayerType>(PlayerTypes.COMPUTER);
  const [onlineRoomId, setOnlineRoomId] = useState<string>(initialRoomId);
  const [onlineAction, setOnlineAction] = useState<OnlineAction>(
    initialRoomId ? "join" : "quick",
  );
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("player");
  const [helpOpen, setHelpOpen] = useState(false);

  // Live Online population, polled only while Online is actually on screen.
  // Answering "is anyone playing?" before the user presses Quick Match is the
  // whole point — without it, pressing the button is a leap of faith.
  const { count: playerCount } = usePlayerCount(gameMode === GameModes.ONLINE);

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

  // Quick Match is the one entry point that cannot work without a backend:
  // create/join only hand a room id to the WebSocket relay, but quick match
  // must call the matchmaking service. In a build with no VITE_MATCHMAKING_URL
  // the tap used to escalate to the app-wide ErrorBoundary and take the
  // whole product down with it. Offer the mode, but say plainly that it is
  // unavailable instead of failing after the click.
  const quickMatchUnavailable =
    gameMode === GameModes.ONLINE && onlineAction === "quick" && !MATCHMAKING_CONFIGURED;
  const startDisabled = !isValid || quickMatchUnavailable;
  const startTitle = quickMatchUnavailable ? MATCHMAKING_UNAVAILABLE_MESSAGE : undefined;
  const startReasonId = useId();
  // The room-code field already shows its own error inline; repeating it
  // under the button would say the same thing twice on one screen.
  const roomFieldError =
    gameMode === GameModes.ONLINE && onlineAction !== "quick" && onlineRoomId.trim()
      ? getRoomCodeError(onlineAction, onlineRoomId.trim())
      : null;
  const validationError = startDisabled ? validate(payload) : null;
  const startReason = quickMatchUnavailable
    ? `${MATCHMAKING_UNAVAILABLE_MESSAGE} Create or join a room instead.`
    : validationError !== roomFieldError
      ? validationError
      : null;
  const startLabel =
    gameMode === GameModes.ONLINE
      ? onlineAction === "quick"
        ? "Quick Match"
        : onlineAction === "create"
          ? "Create Room"
          : "Join Room"
      : "Start Game";

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
        setOpponentName("AI");
        setOpponentType(PlayerTypes.COMPUTER);
      } else if (nextMode === GameModes.VS_FRIEND) {
        // Hydrate the last saved opponent name so Friend mode reopens with it.
        // An empty or invalid saved name used to leave Start permanently
        // disabled with no visible reason, so fall back to a valid default.
        const saved = loadPreferences().opponentName;
        setOpponentName(saved && sanitizeDisplayName(saved) === saved ? saved : "Player 2");
        setOpponentType(PlayerTypes.HUMAN);
      }
    },
    [color],
  );

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

  const aiDifficultyLabel = AI_DIFFICULTY_LABELS[aiDifficulty];

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
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-clip py-0 max-sm:rounded-none max-sm:border-0 max-sm:shadow-none"
      >
        <CardHeader className="flex-row items-center gap-3 px-4 pb-3 pt-4 text-left sm:px-6 sm:pb-5 sm:pt-7">
          <GameMark />
          <div className="min-w-0 flex-1">
            <h1 className="font-display leading-none">
              <span className="block text-sm font-bold tracking-tight text-muted-foreground sm:text-base">
                Tic Tac Toe
              </span>{" "}
              {/* The word does what it says: its tail fades toward the card. */}
              <span className="mt-0.5 block w-fit bg-linear-to-r from-foreground from-45% to-foreground/25 bg-clip-text pb-0.5 text-[1.375rem] font-extrabold tracking-[-0.03em] text-transparent min-[400px]:text-[1.625rem] sm:text-[2rem]">
                Disappear
              </span>
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="How to play"
            className="glass-interactive flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
          >
            <CircleHelp className="size-4.5" aria-hidden="true" />
          </button>
        </CardHeader>
        <LobbyContent
          error={error}
          player={{
            settings: playerSettings,
            onEdit: () => {
              setSettingsTab("player");
              setSettingsOpen(true);
            },
          }}
          opponent={
            gameMode === GameModes.ONLINE
              ? null
              : {
                  settings: opponentSettings,
                  aiDifficultyLabel,
                  onEdit: () => {
                    setSettingsTab("opponent");
                    setSettingsOpen(true);
                  },
                }
          }
          mode={{ selected: gameMode, onChange: handleGameModeChange }}
          online={
            gameMode === GameModes.ONLINE
              ? {
                  count: playerCount,
                  action: onlineAction,
                  roomId: onlineRoomId,
                  fieldError: roomFieldError,
                  onActionChange: setOnlineAction,
                  onRoomIdChange: setOnlineRoomId,
                }
              : null
          }
        />
        <LobbyStartFooter
          start={{
            mode: gameMode,
            label: startLabel,
            color,
            disabled: startDisabled,
            title: startTitle,
            reason: startReason,
            reasonId: startReasonId,
            quickMatchUnavailable,
          }}
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
        onStart={() => {
          if (startGame()) setSettingsOpen(false);
        }}
        startLabel={startLabel}
        startDisabled={startDisabled}
      />

      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </form>
  );
}
