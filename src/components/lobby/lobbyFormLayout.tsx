import { useId } from "react";
import { Check, Hash, KeyRound, LogIn, Play, Plus } from "lucide-react";
import { COLOR_RGB, GameModes, type Color, type GameMode } from "@/game/constants";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { GameModeSelector } from "./gameModeSelector";
import {
  OpponentSummaryCard,
  PlayerSummaryCard,
  type OpponentSettings,
  type PlayerSettings,
} from "./playerSettingsSheet";
import type { PlayerCount } from "@/hooks/usePlayerCount";

export type OnlineAction = "create" | "join" | "quick";

export interface LobbyContentProps {
  error: string | null;
  player: {
    settings: PlayerSettings;
    onEdit: () => void;
  };
  opponent: {
    settings: OpponentSettings;
    aiDifficultyLabel: string;
    onEdit: () => void;
  } | null;
  mode: {
    selected: GameMode;
    onChange: (mode: GameMode) => void;
  };
  online: {
    count: PlayerCount | null;
    action: OnlineAction;
    roomId: string;
    fieldError: string | null;
    onActionChange: (action: OnlineAction) => void;
    onRoomIdChange: (roomId: string) => void;
  } | null;
}

export function LobbyContent({ error, player, opponent, mode, online }: LobbyContentProps) {
  return (
    // Phone forms can grow beyond the viewport. Keep the content as the
    // scrolling middle so the card footer stays reachable.
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

        <PlayerSummaryCard settings={player.settings} onEdit={player.onEdit} />
        {opponent && (
          <OpponentSummaryCard
            opponentName={opponent.settings.opponentName}
            opponentColor={opponent.settings.opponentColor}
            opponentShape={opponent.settings.opponentShape}
            opponentType={opponent.settings.opponentType}
            aiDifficultyLabel={opponent.aiDifficultyLabel}
            onEdit={opponent.onEdit}
          />
        )}

        <GameModeSelector selectedMode={mode.selected} onModeChange={mode.onChange} />

        {mode.selected === GameModes.ONLINE && online && (
          <div className="flex flex-col gap-3">
            <OnlinePopulation count={online.count} />
            <div
              role="radiogroup"
              aria-label="Online match type"
              className="flex flex-col gap-2 sm:grid sm:grid-cols-3"
              onKeyDown={handleRadioGroupKeyDown}
            >
              <OnlineOption
                active={online.action === "quick"}
                icon={<Play className="size-4 shrink-0" aria-hidden="true" />}
                label="Quick"
                description="Auto-match"
                onClick={() => online.onActionChange("quick")}
              />
              <OnlineOption
                active={online.action === "create"}
                icon={<Plus className="size-4 shrink-0" aria-hidden="true" />}
                label="Create"
                description="New room"
                onClick={() => online.onActionChange("create")}
              />
              <OnlineOption
                active={online.action === "join"}
                icon={<LogIn className="size-4 shrink-0" aria-hidden="true" />}
                label="Join"
                description="Enter code"
                onClick={() => online.onActionChange("join")}
              />
            </div>
            {online.action === "create" && (
              <Field
                id="room"
                label="Custom room code (optional)"
                inputMode="text"
                autoCapitalize="none"
                enterKeyHint="go"
                icon={<Hash className="h-3.5 w-3.5" />}
                value={online.roomId}
                placeholder="Leave empty to generate one"
                maxLength={64}
                hint="4-64 letters, numbers, hyphens, or underscores."
                error={online.fieldError ?? undefined}
                onChange={online.onRoomIdChange}
              />
            )}
            {online.action === "join" && (
              <Field
                id="room"
                label="Room code"
                inputMode="text"
                autoCapitalize="none"
                enterKeyHint="go"
                icon={<Hash className="h-3.5 w-3.5" />}
                value={online.roomId}
                placeholder="e.g. friday-game"
                maxLength={64}
                hint="Use the code your friend shared with you."
                error={online.fieldError ?? undefined}
                onChange={online.onRoomIdChange}
              />
            )}
          </div>
        )}
      </div>
    </CardContent>
  );
}

export interface LobbyStartState {
  mode: GameMode;
  label: string;
  color: Color;
  disabled: boolean;
  title?: string;
  reason: string | null;
  reasonId: string;
  quickMatchUnavailable: boolean;
}

export function LobbyStartFooter({ start }: { start: LobbyStartState }) {
  return (
    <CardFooter
      className={cn(
        // On phones the CTA sits in thumb reach above the home indicator.
        "flex flex-col gap-2 px-4 pb-[max(1rem,var(--inset-bottom))] pt-2 sm:px-6 sm:pb-6 sm:pt-1",
        // Wide, short windows need a sticky footer while the content scrolls.
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
        disabled={start.disabled}
        title={start.title}
        aria-describedby={start.reason ? start.reasonId : undefined}
        className={cn(
          "h-12 w-full text-base font-bold sm:h-14",
          start.disabled && "cursor-not-allowed opacity-50",
        )}
        style={{
          "--glass-sweep-color": COLOR_RGB[start.color],
          "--glass-tint": COLOR_RGB[start.color],
          "--glass-alpha": "0.15",
          "--glass-sheen": COLOR_RGB[start.color],
          "--glass-sheen-alpha": "0.25",
        } as React.CSSProperties}
      >
        {start.mode === GameModes.ONLINE ? (
          <>
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            {start.label}
          </>
        ) : (
          <>
            <Play className="h-5 w-5" aria-hidden="true" />
            {start.label}
          </>
        )}
      </Button>
      {/* Desktop keeps validation text out of the layout but in the accessible description. */}
      {start.reason && (
        <p
          id={start.reasonId}
          role={start.quickMatchUnavailable ? "status" : undefined}
          className={cn(
            "text-center text-sm text-muted-foreground",
            start.quickMatchUnavailable ? "sm:text-xs sm:text-white/60" : "sm:sr-only",
          )}
        >
          {start.reason}
        </p>
      )}
    </CardFooter>
  );
}

/** Keep the live queue read absent until the first response, rather than
 * suggesting that nobody is online before polling completes. */
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
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  const descId = useId();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      aria-describedby={descId}
      data-state={active ? "active" : "inactive"}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        // Phone choices are full-width rows; desktop keeps the three-up tile.
        "group relative flex min-h-14 flex-row items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:min-h-[4.5rem] sm:flex-col sm:items-stretch sm:justify-center sm:gap-1.5 sm:px-2.5 sm:py-2.5",
        active
          ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
          : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="flex min-w-0 items-center gap-2 sm:gap-1.5">
        {icon}
        <span className="text-sm font-semibold sm:truncate sm:text-xs">{label}</span>
      </span>
      <span
        id={descId}
        className="text-sm leading-tight text-muted-foreground max-sm:ml-auto sm:text-[11px]"
      >
        {description}
      </span>
      {/* Keep the phone check in flow; pull it out of the desktop tile. */}
      {active && (
        <Check
          className="size-4 shrink-0 text-[rgb(var(--player-color))] sm:absolute sm:right-1.5 sm:top-1.5 sm:size-3.5"
          aria-hidden="true"
        />
      )}
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
