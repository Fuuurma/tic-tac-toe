import { useCallback, useMemo, useState } from "react";
import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  Color,
  GameModes,
  PLAYER_CONFIG,
  PlayerSymbol,
  type AI_Difficulty as AI_DifficultyType,
  type GameMode,
} from "@/game/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { GameModeSelector } from "../game/gameModeSelector";
import { AI_DifficultySelector } from "../game/aiDifficultySelector";
import { Play, Shuffle, User, Users, KeyRound, Plus, LogIn, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateGuestDisplayName, sanitizeDisplayName } from "@/lib/identity";
import { COLOR_BG_CLASSES } from "@/game/constants";

export interface LoginFormPayload {
  displayName: string;
  color: Color;
  gameMode: GameMode;
  aiDifficulty: AI_DifficultyType;
  opponentName: string;
  onlineRoomId: string;
  onlineAction: "create" | "join";
}

interface LoginFormProps {
  onStart: (payload: LoginFormPayload) => void;
}

const validate = (payload: LoginFormPayload): string | null => {
  if (sanitizeDisplayName(payload.displayName) !== payload.displayName) {
    return "Enter a valid name (2-20 characters, no control characters).";
  }
  if (!AVAILABLE_COLORS.includes(payload.color)) {
    return "Pick a color.";
  }
  if (payload.gameMode === GameModes.ONLINE) {
    if (payload.onlineAction === "join" && !payload.onlineRoomId.trim()) {
      return "Enter a room ID to join.";
    }
  }
  return null;
};

export function LoginForm({ onStart }: LoginFormProps) {
  const [displayName, setDisplayName] = useState<string>(generateGuestDisplayName());
  const [color, setColor] = useState<Color>(PLAYER_CONFIG[PlayerSymbol.X].defaultColor);
  const [gameMode, setGameMode] = useState<GameMode>(GameModes.VS_COMPUTER);
  const [aiDifficulty, setAI_Difficulty] = useState<AI_DifficultyType>(AI_Difficulty.EASY);
  const [opponentName, setOpponentName] = useState<string>("Player 2");
  const [onlineRoomId, setOnlineRoomId] = useState<string>("");
  const [onlineAction, setOnlineAction] = useState<"create" | "join">("create");
  const [error, setError] = useState<string | null>(null);

  const payload: LoginFormPayload = useMemo(
    () => ({
      displayName: sanitizeDisplayName(displayName),
      color,
      gameMode,
      aiDifficulty,
      opponentName: sanitizeDisplayName(opponentName, "Player 2"),
      onlineRoomId: onlineRoomId.trim(),
      onlineAction,
    }),
    [displayName, color, gameMode, aiDifficulty, opponentName, onlineRoomId, onlineAction],
  );

  const isValid = useMemo(() => validate(payload) === null, [payload]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const err = validate(payload);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onStart(payload);
    },
    [payload, onStart],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <Card className="gap-0 overflow-hidden border-2 bg-card/90 py-0 shadow-2xl backdrop-blur-md">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500" />
        <CardHeader className="px-4 pb-2 pt-4 text-center sm:px-6 sm:pb-3 sm:pt-5">
          <div className="mx-auto mb-2 grid h-10 w-10 grid-cols-3 gap-1 rounded-xl border bg-background/80 p-1 shadow-inner sm:mb-3 sm:h-12 sm:w-12">
            {["X", "", "O", "", "X", "", "O", "", "X"].map((mark, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="flex items-center justify-center rounded bg-muted/80 text-[10px] font-black text-muted-foreground"
              >
                {mark}
              </span>
            ))}
          </div>
          <CardTitle className="text-2xl font-black tracking-normal">Tic Tac Toe</CardTitle>
          <CardDescription className="text-xs leading-tight">
            Pick a mode, choose your color, and jump in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5 px-4 pb-3 pt-0 sm:space-y-3 sm:px-6">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </div>
          )}

          <Field
            id="name"
            label="Your name"
            icon={<User className="h-3.5 w-3.5" />}
            value={payload.displayName}
            placeholder={PLAYER_CONFIG[PlayerSymbol.X].label}
            onChange={setDisplayName}
          />

          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
              Your color
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {AVAILABLE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition sm:h-8 sm:w-8",
                    COLOR_BG_CLASSES[c],
                    color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100",
                  )}
                />
              ))}
            </div>
          </div>

          <GameModeSelector selectedMode={gameMode} onModeChange={setGameMode} />

          {gameMode === GameModes.VS_COMPUTER && (
            <AI_DifficultySelector
              selectedDifficulty={aiDifficulty}
              onDifficultyChange={setAI_Difficulty}
            />
          )}

          {gameMode === GameModes.VS_FRIEND && (
            <Field
              id="opponent"
              label="Opponent's name"
              icon={<Users className="h-3.5 w-3.5" />}
              value={payload.opponentName}
              placeholder="Player 2"
              onChange={setOpponentName}
            />
          )}

          {gameMode === GameModes.ONLINE && (
            <div className="space-y-2 rounded-lg border bg-background/50 p-3">
              <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-0.5">
                <button
                  type="button"
                  aria-pressed={onlineAction === "create"}
                  onClick={() => setOnlineAction("create")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-semibold transition",
                    onlineAction === "create"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create
                </button>
                <button
                  type="button"
                  aria-pressed={onlineAction === "join"}
                  onClick={() => setOnlineAction("join")}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-semibold transition",
                    onlineAction === "join"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Join
                </button>
              </div>
              {onlineAction === "join" && (
                <Field
                  id="room"
                  label="Room ID"
                  icon={<Hash className="h-3.5 w-3.5" />}
                  value={onlineRoomId}
                  placeholder="e.g. a1b2c3d4"
                  onChange={setOnlineRoomId}
                />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 px-4 pb-3 pt-0 sm:px-6 sm:pb-4">
          <Button
            type="submit"
            size="lg"
            disabled={!isValid}
            className={cn(
              "h-11 w-full text-base font-bold sm:h-12",
              isValid ? "shadow-lg hover:shadow-xl" : "cursor-not-allowed opacity-50",
            )}
          >
            {gameMode === GameModes.ONLINE ? (
              <>
                <KeyRound className="h-5 w-5" />
                {onlineAction === "create" ? "Create Room" : "Join Room"}
              </>
            ) : isValid ? (
              <>
                <Play className="h-5 w-5" />
                Start Game
              </>
            ) : (
              <>
                <Shuffle className="h-5 w-5" />
                Fill in your name
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

function Field({ id, label, icon, value, placeholder, onChange }: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
        {icon}
        {label}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        maxLength={20}
        autoComplete="off"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      />
    </label>
  );
}
