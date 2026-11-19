import { useId } from "react";
import { type TurnAction } from "@/game/constants";
import { t } from "@/i18n/language";
import { CardHeader } from "@/components/ui/card";
import {
  Play,
  Plus,
  LogIn,
  Hash,
  TriangleAlert,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { type PlayerCount } from "@/hooks/usePlayerCount";
import { pickerTileClass } from "@/lib/pickerClasses";
import { GameMark } from "./gameMark";

/* Presentational sections of the lobby card above the fold: the masthead
   (GameMark, wordmark, preferences gear) and the Online match block
   (population readout, match-type radiogroup, room-code fields). Pure
   props in, DOM out — the orchestrator in lobbyForm.tsx owns all state. */

export function LobbyCardHeader({ onOpenPreferences }: { onOpenPreferences: () => void }) {
  return (
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
            className="mt-0.5 block w-fit bg-linear-to-r from-foreground from-45% to-foreground/60 bg-clip-text pb-0.5 text-[1.375rem] font-extrabold tracking-[-0.03em] text-transparent max-[359px]:text-[1.25rem] min-[400px]:text-[1.5rem] sm:text-[1.625rem]"
          >
            Disappear
          </span>
          <span className="sr-only">Tic Tac Toe Disappear</span>
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {/* One control for theme, language, help and the tutorial. It
            opens on the App tab because that is what the masthead icon
            promises; the lobby's identity setup is reached from the
            summary cards below. */}
        <button
          type="button"
          onClick={onOpenPreferences}
          aria-label={t("settings.open")}
          title={t("settings.open")}
          className="glass-interactive flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
        >
          <Settings2 className="size-4.5" aria-hidden="true" />
        </button>
      </div>
    </CardHeader>
  );
}

export function OnlineMatchSection({
  playerCount,
  onlineAction,
  explainedAction,
  onChooseAction,
  deadReason,
  onlineRoomId,
  onRoomIdChange,
  roomFieldError,
}: {
  playerCount: PlayerCount | null;
  onlineAction: TurnAction;
  explainedAction: TurnAction | null;
  onChooseAction: (action: TurnAction) => void;
  deadReason: (action: TurnAction) => string | null;
  onlineRoomId: string;
  onRoomIdChange: (value: string) => void;
  roomFieldError: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <OnlinePopulation count={playerCount} />
      <div
        role="radiogroup"
        aria-label={t("lobby.matchType")}
        className="flex flex-col gap-2 sm:grid sm:grid-cols-3"
        onKeyDown={handleRadioGroupKeyDown}
      >
        <OnlineOption
          active={onlineAction === "quick"}
          icon={<Play className="size-5 shrink-0" aria-hidden="true" />}
          label={t("lobby.action.quick")}
          onClick={() => onChooseAction("quick")}
          disabledReason={deadReason("quick") ?? undefined}
          explained={explainedAction === "quick"}
        />
        <OnlineOption
          active={onlineAction === "create"}
          icon={<Plus className="size-5 shrink-0" aria-hidden="true" />}
          label={t("lobby.action.create")}
          onClick={() => onChooseAction("create")}
          disabledReason={deadReason("create") ?? undefined}
          explained={explainedAction === "create"}
        />
        <OnlineOption
          active={onlineAction === "join"}
          icon={<LogIn className="size-5 shrink-0" aria-hidden="true" />}
          label={t("lobby.action.join")}
          onClick={() => onChooseAction("join")}
          disabledReason={deadReason("join") ?? undefined}
          explained={explainedAction === "join"}
        />
      </div>
      {onlineAction === "create" && (
        <Field
          id="room"
          label={t("lobby.roomCustom")}
          inputMode="text"
          autoCapitalize="none"
          enterKeyHint="go"
          icon={<Hash className="h-3.5 w-3.5" />}
          value={onlineRoomId}
          placeholder={t("lobby.roomCustomPlaceholder")}
          maxLength={64}
          hint={t("lobby.roomCustomHint")}
          error={roomFieldError ?? undefined}
          onChange={onRoomIdChange}
        />
      )}
      {onlineAction === "join" && (
        <Field
          id="room"
          label={t("lobby.roomCode")}
          inputMode="text"
          autoCapitalize="none"
          enterKeyHint="go"
          icon={<Hash className="h-3.5 w-3.5" />}
          value={onlineRoomId}
          placeholder={t("lobby.roomCodePlaceholder")}
          maxLength={64}
          hint={t("lobby.roomJoinHint")}
          error={roomFieldError ?? undefined}
          onChange={onRoomIdChange}
        />
      )}
    </div>
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
        ? t("lobby.population.empty")
        : (players === 1
            ? t("lobby.population.one", { count: players })
            : t("lobby.population.many", { count: players })) +
          (waiting > 0 ? t("lobby.population.looking", { count: waiting }) : "")}
    </p>
  );
}

function OnlineOption({
  active,
  icon,
  label,
  onClick,
  disabledReason,
  explained = false,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  /** When set, the option cannot be picked. Tapping it (or hovering,
      or focusing it and pressing Enter) reveals the reason below instead;
      nothing is shown until asked. */
  disabledReason?: string;
  /** Whether this option's reason is currently revealed. */
  explained?: boolean;
}) {
  const reasonId = useId();
  return (
    <span title={disabledReason} className="contents">
      <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-state={active ? "active" : "inactive"}
      tabIndex={disabledReason ? 0 : active ? 0 : -1}
      aria-disabled={disabledReason ? true : undefined}
      aria-describedby={disabledReason && explained ? reasonId : undefined}
      onClick={onClick}
      className={cn(
        // No check mark: the tile itself is the selection signal — contour
        // (ring-2), highlight (tinted fill), player-color icon. Centered.
        "group relative flex min-h-14 w-full flex-row items-center justify-center gap-3 rounded-lg border px-3.5 py-3 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:min-h-[4.5rem] sm:flex-col sm:items-center sm:justify-center sm:gap-1.5 sm:px-2.5 sm:py-2.5",
        disabledReason
          ? "cursor-not-allowed border-border/50 bg-background/30 text-muted-foreground/60 opacity-70"
          : pickerTileClass(active, "strong"),
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
      {disabledReason && (
        <TriangleAlert
          className="absolute top-1.5 right-1.5 size-4 text-amber-500 dark:text-amber-400"
          aria-hidden="true"
        />
      )}
      </button>
      {disabledReason && explained && (
        <p id={reasonId} role="status" className="text-sm text-muted-foreground sm:col-span-full">
          {disabledReason}
        </p>
      )}
    </span>
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
