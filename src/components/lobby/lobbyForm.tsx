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
  ONLINE_UNAVAILABLE,
} from "@/lib/matchmaking";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { GameModeSelector } from "./gameModeSelector";
import { GameMark } from "./gameMark";
import { ThemeToggle } from "./themeToggle";
import {
  SettingsSheet,
  type SettingsTab,
  PlayerSummaryCard,
  OpponentSummaryCard,
  type PlayerSettings,
  type OpponentSettings,
} from "./playerSettingsSheet";
import {
  CircleHelp,
  Play,
  KeyRound,
  Plus,
  LogIn,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrCreateGuestIdentity, sanitizeDisplayName, saveDisplayName } from "@/lib/identity";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { ROOM_ID_PATTERN, normalizeRoomId } from "@/lib/roomId";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { usePlayerCount, type PlayerCount } from "@/hooks/usePlayerCount";

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
  onlineAction: "create" | "join" | "quick";
}

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

export function LobbyForm({ initialRoomId = "", onStart, onReplayTutorial }: LobbyFormProps) {
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
  const [onlineAction, setOnlineAction] = useState<"create" | "join" | "quick">(
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

  // No backend means no online play, and the lobby must say so before the
  // click instead of failing after it. A production build with no
  // VITE_MATCHMAKING_URL cannot reach the relay either, so Create and Join
  // are blocked too (the tap used to escalate to the app-wide ErrorBoundary,
  // or dial the visitor's own 127.0.0.1). Local dev still reaches a relay at
  // its 127.0.0.1 default, so there only Quick Match, which needs the
  // matchmaking service, is blocked.
  const onlineUnavailable =
    gameMode === GameModes.ONLINE &&
    (ONLINE_UNAVAILABLE || (onlineAction === "quick" && !MATCHMAKING_CONFIGURED));
  const startDisabled = !isValid || onlineUnavailable;
  const startTitle = onlineUnavailable ? MATCHMAKING_UNAVAILABLE_MESSAGE : undefined;
  const startReasonId = useId();
  // The room-code field already shows its own error inline; repeating it
  // under the button would say the same thing twice on one screen.
  const roomFieldError =
    gameMode === GameModes.ONLINE && onlineAction !== "quick" && onlineRoomId.trim()
      ? getRoomCodeError(onlineAction, onlineRoomId.trim())
      : null;
  const validationError = startDisabled ? validate(payload) : null;
  const startReason = onlineUnavailable
    ? ONLINE_UNAVAILABLE
      ? MATCHMAKING_UNAVAILABLE_MESSAGE
      : `${MATCHMAKING_UNAVAILABLE_MESSAGE} Create or join a room instead.`
    : validationError !== roomFieldError
      ? validationError
      : null;

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
        className="lobby-screen-glass flex min-h-0 flex-1 flex-col gap-0 overflow-clip py-0 max-sm:rounded-none max-sm:border-0 max-sm:shadow-none"
      >
        <CardHeader className="flex-row items-center gap-3 px-4 pb-3 pt-4 text-left sm:px-6 sm:pb-5 sm:pt-7">
          <GameMark />
          <div className="min-w-0 flex-1">
            <h1 className="inline-flex w-fit max-w-full flex-col font-display leading-none">
              <span
                aria-hidden="true"
                className="flex w-full items-center gap-1.5 text-lg font-bold tracking-[0.1em] text-muted-foreground sm:gap-2 sm:text-xl"
              >
                <span>Tic</span>
                <span>Tac</span>
                <span className="bg-linear-to-r from-muted-foreground from-45% to-muted-foreground/25 bg-clip-text text-transparent">
                  Toe
                </span>
              </span>
              {/* The word does what it says: its tail fades toward the card —
                  but the floor stays legible (/60, not /25), otherwise the
                  tail vanishes on light glass and reads as a clipped word. */}
              <span
                aria-hidden="true"
                className="mt-0.5 block w-fit bg-linear-to-r from-foreground from-45% to-foreground/60 bg-clip-text pb-0.5 text-[1.375rem] font-extrabold tracking-[-0.03em] text-transparent max-[359px]:text-[1.25rem] min-[400px]:text-[1.5rem] sm:text-[2rem]"
              >
                Disappear
              </span>
              <span className="sr-only">Tic Tac Toe Disappear</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="How to play"
              className="glass-interactive flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
            >
              <CircleHelp className="size-4.5" aria-hidden="true" />
            </button>
          </div>
        </CardHeader>
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

          <GameModeSelector selectedMode={gameMode} onModeChange={handleGameModeChange} />

          {gameMode === GameModes.ONLINE && (
            <div className="flex flex-col gap-3">
              <OnlinePopulation count={playerCount} />
              <div
                role="radiogroup"
                aria-label="Online match type"
                className="flex flex-col gap-2 sm:grid sm:grid-cols-3"
                onKeyDown={handleRadioGroupKeyDown}
              >
                <OnlineOption
                  active={onlineAction === "quick"}
                  icon={<Play className="size-5 shrink-0" aria-hidden="true" />}
                  label="Quick"
                  onClick={() => setOnlineAction("quick")}
                />
                <OnlineOption
                  active={onlineAction === "create"}
                  icon={<Plus className="size-5 shrink-0" aria-hidden="true" />}
                  label="Create"
                  onClick={() => setOnlineAction("create")}
                />
                <OnlineOption
                  active={onlineAction === "join"}
                  icon={<LogIn className="size-5 shrink-0" aria-hidden="true" />}
                  label="Join"
                  onClick={() => setOnlineAction("join")}
                />
              </div>
              {onlineAction === "create" && (
                <Field
                  id="room"
                  label="Custom room code (optional)"
                  inputMode="text"
                  autoCapitalize="none"
                  enterKeyHint="go"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  value={onlineRoomId}
                  placeholder="Leave empty to generate one"
                  maxLength={64}
                  hint="4-64 letters, numbers, hyphens, or underscores."
                  error={roomFieldError ?? undefined}
                  onChange={setOnlineRoomId}
                />
              )}
              {onlineAction === "join" && (
                <Field
                  id="room"
                  label="Room code"
                  inputMode="text"
                  autoCapitalize="none"
                  enterKeyHint="go"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  value={onlineRoomId}
                  placeholder="e.g. friday-game"
                  maxLength={64}
                  hint="Use the code your friend shared with you."
                  error={roomFieldError ?? undefined}
                  onChange={setOnlineRoomId}
                />
              )}
            </div>
          )}
          </div>
        </CardContent>
        <CardFooter
          className={cn(
            // Phones: the CTA sits in thumb reach above the home indicator.
            "flex flex-col gap-2 px-4 pb-[max(1rem,var(--inset-bottom))] pt-2 sm:px-6 sm:pb-6 sm:pt-1",
            // A wide-but-short window (a rotated tablet, or any desktop
            // window under 560px tall) is past the `sm:h-auto` breakpoint,
            // so the card sizes to its content and outgrows the scrollport
            // instead of stretching. Pinning the footer to the bottom of
            // that scrollport keeps Start in thumb reach while the settings
            // above scroll underneath. `overflow-clip` on the Card is what
            // allows this: `overflow-hidden` would establish a scroll
            // container and the footer would stick to a box that never
            // scrolls. On phones this is inert — the footer simply sits
            // below the scrolling content already.
            "landscape-short:sticky landscape-short:bottom-0",
            "landscape-short:border-t landscape-short:border-border/60",
            "landscape-short:bg-background/80 landscape-short:backdrop-blur-md",
            "landscape-short:pb-[max(1.25rem,var(--inset-bottom))]",
          )}
        >
          <Button
            type="submit"
            size="lg"
            variant="glass"
            disabled={startDisabled}
            title={startTitle}
            aria-describedby={startReason ? startReasonId : undefined}
            className={cn(
              "h-12 w-full text-base font-bold sm:h-14",
              startDisabled && "cursor-not-allowed opacity-50",
            )}
            style={{
              "--glass-sweep-color": COLOR_RGB[color],
              "--glass-tint": COLOR_RGB[color],
              "--glass-alpha": "0.15",
              "--glass-sheen": COLOR_RGB[color],
              "--glass-sheen-alpha": "0.25",
            } as React.CSSProperties}
          >
            {gameMode === GameModes.ONLINE ? (
              <>
                <KeyRound className="h-5 w-5" aria-hidden="true" />
                {onlineAction === "quick"
                  ? "Quick Match"
                  : onlineAction === "create"
                    ? "Create Room"
                    : "Join Room"}
              </>
            ) : (
              <>
                <Play className="h-5 w-5" aria-hidden="true" />
                Start Game
              </>
            )}
          </Button>
          {/* Says why Start is disabled. On desktop the text stays out of the
              layout (sr-only) so the 1280x800 view is unchanged, but it is still
              the button's accessible description. */}
          {startReason && (
            <p
              id={startReasonId}
              role={onlineUnavailable ? "status" : undefined}
              className={cn(
                "text-center text-sm text-muted-foreground",
                onlineUnavailable ? "sm:text-xs sm:text-white/60" : "sm:sr-only",
              )}
            >
              {startReason}
            </p>
          )}
        </CardFooter>
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
        startLabel={
          gameMode === GameModes.ONLINE
            ? onlineAction === "quick"
              ? "Quick Match"
              : onlineAction === "create"
                ? "Create Room"
                : "Join Room"
            : "Start Game"
        }
        startDisabled={startDisabled}
      />

      <HelpDrawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onReplayTutorial={onReplayTutorial}
      />
    </form>
  );
}

/**
 * Live population readout for Online mode.
 *
 * Renders nothing until the first successful read: a confident "0 players"
 * while the request is still in flight is worse than no line at all, since
 * it reads as "nobody is playing" and talks people out of pressing Quick
 * Match. Once known, the queue depth is called out separately from the
 * total, because only the queued players are the ones you can actually be
 * matched with.
 */
function OnlinePopulation({ count }: { count: PlayerCount | null }) {
  if (!count) return null;
  const { players, waiting } = count;
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground sm:text-[11px] sm:leading-[normal]"
    >
      <span aria-hidden="true" className="relative flex size-1.5 shrink-0">
        <span className="animate-pulse-slow absolute inline-flex size-full rounded-full bg-[rgb(var(--player-color))] opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-[rgb(var(--player-color))]" />
      </span>
      {players === 0
        ? "No players online right now"
        : `${players} ${players === 1 ? "player" : "players"} online` +
          (waiting > 0 ? ` · ${waiting} looking` : "")}
    </p>
  );
}

function OnlineOption({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-state={active ? "active" : "inactive"}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        // No check mark: the tile itself is the selection signal — contour
        // (ring-2), highlight (tinted fill), player-color icon. Centered.
        "group relative flex min-h-14 flex-row items-center justify-center gap-3 rounded-lg border px-3.5 py-3 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:min-h-[4.5rem] sm:flex-col sm:items-center sm:justify-center sm:gap-1.5 sm:px-2.5 sm:py-2.5",
        active
          ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.15)] text-foreground shadow-md ring-2 ring-[rgb(var(--player-color)/0.35)]"
          : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex min-w-0 items-center justify-center gap-2 transition-colors duration-200 sm:flex-col sm:gap-1.5",
          active && "text-[rgb(var(--player-color))]",
        )}
      >
        {icon}
        <span className="text-sm font-semibold sm:text-xs">{label}</span>
      </span>
    </button>
  );
}

interface FieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  maxLength?: number;
  hint?: string;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoCapitalize?: "characters" | "none";
  enterKeyHint?: "go" | "done";
  onChange: (value: string) => void;
}

function Field({
  id,
  label,
  icon,
  value,
  placeholder,
  maxLength = 20,
  hint,
  error,
  inputMode,
  autoCapitalize,
  enterKeyHint,
  onChange,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label htmlFor={id} className="block" data-invalid={error ? "true" : undefined}>
      <span className="mb-1.5 flex items-center gap-1 text-sm font-semibold tracking-normal text-muted-foreground sm:text-[11px] sm:leading-[normal]">
        {icon}
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        enterKeyHint={enterKeyHint}
        className={cn(
          "h-11 w-full rounded-lg border border-input bg-background/60 px-3 text-field outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
          error && "border-destructive focus-visible:ring-destructive",
        )}
      />
      {hint && !error && (
        <span id={hintId} className="mt-1.5 block text-sm leading-tight text-muted-foreground sm:text-xs">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="mt-1.5 block text-sm leading-tight text-destructive sm:text-xs">
          {error}
        </span>
      )}
    </label>
  );
}
