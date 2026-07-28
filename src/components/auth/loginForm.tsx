import { useCallback, useMemo, useState } from "react";
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
  type PlayerType,
} from "@/game/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { GameModeSelector } from "../game/gameModeSelector";
import { GameMark } from "./gameMark";
import {
  SettingsSheet,
  type SettingsTab,
  PlayerSummaryCard,
  OpponentSummaryCard,
  type PlayerSettings,
  type OpponentSettings,
} from "./playerSettingsSheet";
import {
  Check,
  CircleHelp,
  Play,
  KeyRound,
  Plus,
  LogIn,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrCreateGuestIdentity, sanitizeDisplayName, saveDisplayName } from "@/lib/identity";
import { HelpDrawer } from "@/components/game/helpDrawer";
import { normalizeRoomId } from "@/lib/roomId";

export interface LoginFormPayload {
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

interface LoginFormProps {
  initialRoomId?: string;
  onStart: (payload: LoginFormPayload) => void;
}

const getRoomCodeError = (
  action: LoginFormPayload["onlineAction"],
  roomId: string,
): string | null => {
  if (action === "join") {
    if (!roomId) return "Enter a room code to join.";
    if (!normalizeRoomId(roomId)) {
      return "Room code must be 4–64 letters, digits, hyphens, or underscores.";
    }
  }
  if (action === "create" && roomId && !normalizeRoomId(roomId)) {
    return "Custom room code must be 4–64 letters, digits, hyphens, or underscores.";
  }
  return null;
};

const validate = (payload: LoginFormPayload): string | null => {
  if (sanitizeDisplayName(payload.displayName) !== payload.displayName) {
    return "Enter a valid name (2-20 characters, no control characters).";
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

export function LoginForm({ initialRoomId = "", onStart }: LoginFormProps) {
  const [displayName, setDisplayName] = useState<string>(
    () => getOrCreateGuestIdentity().displayName,
  );
  const [color, setColor] = useState<Color>(PLAYER_CONFIG[PlayerSymbol.X].defaultColor);
  const [playerShape, setPlayerShape] = useState<SymbolShape>(PLAYER_CONFIG[PlayerSymbol.X].defaultShape);
  const [opponentColor, setOpponentColor] = useState<Color>(
    PLAYER_CONFIG[PlayerSymbol.O].defaultColor,
  );
  const [opponentShape, setOpponentShape] = useState<SymbolShape>(PLAYER_CONFIG[PlayerSymbol.O].defaultShape);
  const [gameMode, setGameMode] = useState<GameMode>(
    initialRoomId ? GameModes.ONLINE : GameModes.VS_COMPUTER,
  );
  const [aiDifficulty, setAI_Difficulty] = useState<AI_DifficultyType>(AI_Difficulty.EASY);
  const [opponentName, setOpponentName] = useState<string>("AI");
  const [opponentType, setOpponentType] = useState<PlayerType>(PlayerTypes.COMPUTER);
  const [onlineRoomId, setOnlineRoomId] = useState<string>(initialRoomId);
  const [onlineAction, setOnlineAction] = useState<"create" | "join" | "quick">(
    initialRoomId ? "join" : "quick",
  );
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("player");
  const [helpOpen, setHelpOpen] = useState(false);

  const payload: LoginFormPayload = useMemo(
    () => ({
      displayName: sanitizeDisplayName(displayName),
      color,
      opponentColor,
      playerShape,
      opponentShape,
      gameMode,
      aiDifficulty,
      opponentName: sanitizeDisplayName(opponentName, "AI"),
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
      // Keep opponent color opposite in non-friend modes; in VS Friend the
      // opponent sheet owns the opponent color and ensures distinctness.
      if (gameMode !== GameModes.VS_FRIEND) {
        setOpponentColor(oppositeColor(next.color));
      }
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
      if (next.opponentColor === color) {
        setColor(opponentColor);
        setOpponentColor(next.opponentColor);
      } else {
        setOpponentColor(next.opponentColor);
      }
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
        setOpponentName("");
        setOpponentType(PlayerTypes.HUMAN);
      }
    },
    [color],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const err = validate(payload);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      saveDisplayName(payload.displayName);
      onStart(payload);
    },
    [payload, onStart],
  );

  const aiDifficultyLabel =
    aiDifficulty === AI_Difficulty.EASY
      ? "Easy"
      : aiDifficulty === AI_Difficulty.NORMAL
        ? "Normal"
        : "Hard";

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md"
      style={{ "--player-color": COLOR_RGB[color] } as React.CSSProperties}
    >
      <Card variant="glass" className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex-row items-center gap-3 px-5 pb-4 pt-6 text-left sm:px-6 sm:pb-5 sm:pt-7">
          <GameMark />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black leading-none tracking-tight sm:text-2xl">
              Tic Tac Toe Disappear
            </h1>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
              Three-piece strategy
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="How to play"
            className="glass-interactive flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          >
            <CircleHelp className="size-4.5" aria-hidden="true" />
          </button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-5 pb-4 pt-0 sm:gap-3.5 sm:px-6">
          {error && (
            <div
              role="alert"
              className="glass-cell rounded-lg border-destructive/30 px-3.5 py-2.5 text-xs text-destructive"
            >
              {error}
            </div>
          )}

          <PlayerSummaryCard
            settings={playerSettings}
            gameMode={gameMode}
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
              <div
                role="radiogroup"
                aria-label="Online match type"
                className="grid grid-cols-3 gap-2"
              >
                <OnlineOption
                  active={onlineAction === "quick"}
                  icon={<Play className="size-4 shrink-0" aria-hidden="true" />}
                  label="Quick"
                  description="Auto-match"
                  onClick={() => setOnlineAction("quick")}
                />
                <OnlineOption
                  active={onlineAction === "create"}
                  icon={<Plus className="size-4 shrink-0" aria-hidden="true" />}
                  label="Create"
                  description="New room"
                  onClick={() => setOnlineAction("create")}
                />
                <OnlineOption
                  active={onlineAction === "join"}
                  icon={<LogIn className="size-4 shrink-0" aria-hidden="true" />}
                  label="Join"
                  description="Enter code"
                  onClick={() => setOnlineAction("join")}
                />
              </div>
              {onlineAction === "create" && (
                <Field
                  id="room"
                  label="Custom room code (optional)"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  value={onlineRoomId}
                  placeholder="Leave empty to generate one"
                  maxLength={64}
                  hint="4–64 letters, numbers, hyphens, or underscores."
                  error={
                    onlineRoomId.trim()
                      ? getRoomCodeError("create", onlineRoomId.trim()) ?? undefined
                      : undefined
                  }
                  onChange={setOnlineRoomId}
                />
              )}
              {onlineAction === "join" && (
                <Field
                  id="room"
                  label="Room code"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  value={onlineRoomId}
                  placeholder="e.g. friday-game"
                  maxLength={64}
                  hint="Use the code your friend shared with you."
                  error={
                    onlineRoomId.trim()
                      ? getRoomCodeError("join", onlineRoomId.trim()) ?? undefined
                      : undefined
                  }
                  onChange={setOnlineRoomId}
                />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 px-5 pb-5 pt-1 sm:px-6 sm:pb-6">
          <Button
            type="submit"
            size="lg"
            variant="glass"
            disabled={!isValid}
            className={cn(
              "h-12 w-full text-base font-bold sm:h-14",
              !isValid && "cursor-not-allowed opacity-50",
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
      />

      <HelpDrawer isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </form>
  );
}

function OnlineOption({
  active,
  icon,
  label,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-state={active ? "active" : "inactive"}
      onClick={onClick}
      className={cn(
        "group flex min-h-[4.5rem] flex-col items-stretch justify-center gap-1.5 rounded-lg border px-2.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        active
          ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
          : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1.5">
          {icon}
          <span className="truncate text-xs font-semibold">{label}</span>
        </span>
        {active && <Check className="size-3.5 shrink-0 text-[rgb(var(--player-color))]" aria-hidden="true" />}
      </span>
      <span className="text-[11px] leading-tight text-muted-foreground">
        {description}
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
  onChange,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <label htmlFor={id} className="block" data-invalid={error ? "true" : undefined}>
      <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        className={cn(
          "h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
          error && "border-destructive focus-visible:ring-destructive",
        )}
      />
      {hint && !error && (
        <span id={hintId} className="mt-1.5 block text-xs leading-tight text-muted-foreground">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="mt-1.5 block text-xs leading-tight text-destructive">
          {error}
        </span>
      )}
    </label>
  );
}
