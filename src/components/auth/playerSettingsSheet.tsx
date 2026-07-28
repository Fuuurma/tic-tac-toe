import { useEffect, useId, useRef } from "react";
import {
  COLOR_BG_CLASSES,
  COLOR_RGB,
  Color,
  GameModes,
  PlayerTypes,
  SymbolShape,
  type AI_Difficulty as AI_DifficultyType,
  type PlayerType,
} from "@/game/constants";
import { Button } from "@/components/ui/button";
import { SymbolShapePicker } from "./symbolShapePicker";
import { ColorPicker } from "../game/colorPicker";
import { AI_DifficultySelector } from "../game/aiDifficultySelector";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";
import { Bot, Pencil, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeDisplayName } from "@/lib/identity";

export type GameModeValue =
  | typeof GameModes.VS_COMPUTER
  | typeof GameModes.VS_FRIEND
  | typeof GameModes.ONLINE;

export interface PlayerSettings {
  displayName: string;
  color: Color;
  playerShape: SymbolShape;
}

export interface OpponentSettings {
  opponentName: string;
  opponentColor: Color;
  opponentShape: SymbolShape;
  opponentType: PlayerType;
  aiDifficulty: AI_DifficultyType;
}

/* ------------------------------------------------------------------ */
/* Shared sheet hook (focus trap, escape, restore focus)               */
/* ------------------------------------------------------------------ */

function useSheetFocus(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasPreviousFocusRef = useRef(false);
  const sheetId = useId();
  const titleId = `${sheetId}-title`;

  useEffect(() => {
    if (!isOpen) {
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      previousFocusRef.current = null;
      hasPreviousFocusRef.current = false;
      return;
    }
    if (!hasPreviousFocusRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      hasPreviousFocusRef.current = true;
    }
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return { containerRef, panelRef, titleId, sheetId };
}

/* ------------------------------------------------------------------ */
/* Unified settings sheet with tabs                                    */
/* ------------------------------------------------------------------ */

export type SettingsTab = "player" | "opponent";

interface SettingsSheetProps {
  isOpen: boolean;
  gameMode: GameModeValue;
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  player: PlayerSettings;
  opponent: OpponentSettings;
  onPlayerChange: (next: PlayerSettings) => void;
  onOpponentChange: (next: OpponentSettings) => void;
  onClose: () => void;
}

export function SettingsSheet({
  isOpen,
  gameMode,
  tab,
  onTabChange,
  player,
  opponent,
  onPlayerChange,
  onOpponentChange,
  onClose,
}: SettingsSheetProps) {
  const { containerRef, panelRef, titleId, sheetId } = useSheetFocus(isOpen, onClose);
  const playerPanelId = `${sheetId}-panel-player`;
  const opponentPanelId = `${sheetId}-panel-opponent`;

  if (!isOpen) return null;

  const isOnline = gameMode === GameModes.ONLINE;
  const showOpponentTab = !isOnline;
  const isAI = opponent.opponentType === PlayerTypes.COMPUTER;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center"
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="glass animate-pop-in flex max-h-[85dvh] w-full max-w-md flex-col gap-6 rounded-t-2xl border-b-0 p-5 pb-7 outline-none sm:rounded-2xl sm:border-b"
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden" />
          <h2 id={titleId} className="text-base font-semibold">
            Settings
          </h2>
          <Button
            variant="glass"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            className="size-8 p-0"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Tab switcher */}
        <div role="tablist" aria-label="Settings tabs" className="flex shrink-0 gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "player"}
            aria-controls={playerPanelId}
            onClick={() => onTabChange("player")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              tab === "player"
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <User className="size-3.5" aria-hidden="true" />
            You
          </button>
          {showOpponentTab && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "opponent"}
              aria-controls={opponentPanelId}
              onClick={() => onTabChange("opponent")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                tab === "opponent"
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Bot className="size-3.5" aria-hidden="true" />
              {isAI ? "AI" : "Opponent"}
            </button>
          )}
        </div>

        {/* Tab content */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {tab === "player" && (
            <div role="tabpanel" id={playerPanelId}>
              <PlayerTab
                isOnline={isOnline}
                value={player}
                onChange={onPlayerChange}
              />
            </div>
          )}
          {tab === "opponent" && showOpponentTab && (
            <div role="tabpanel" id={opponentPanelId}>
              <OpponentTab
                value={opponent}
                onChange={onOpponentChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Player tab content                                                  */
/* ------------------------------------------------------------------ */

function PlayerTab({
  isOnline,
  value,
  onChange,
}: {
  isOnline: boolean;
  value: PlayerSettings;
  onChange: (next: PlayerSettings) => void;
}) {
  return (
    <>
      <SymbolShapePicker
        value={value.playerShape}
        disabled={isOnline}
        onChange={(shape) => onChange({ ...value, playerShape: shape })}
      />

      <label htmlFor="sheet-name" className="block">
        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="size-3.5" />
          Name
        </span>
        <input
          id="sheet-name"
          type="text"
          value={value.displayName}
          placeholder="Your name"
          onChange={(e) => onChange({ ...value, displayName: sanitizeDisplayName(e.target.value) })}
          maxLength={20}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <ColorPicker
        label="Your color"
        shape={value.playerShape}
        value={value.color}
        onChange={(nextColor) => onChange({ ...value, color: nextColor })}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Opponent tab content                                                */
/* ------------------------------------------------------------------ */

function OpponentTab({
  value,
  onChange,
}: {
  value: OpponentSettings;
  onChange: (next: OpponentSettings) => void;
}) {
  const isAI = value.opponentType === PlayerTypes.COMPUTER;

  return (
    <>
      {/* Type toggle: Human / AI */}
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Type
        </span>
        <div role="radiogroup" aria-label="Opponent type" className="grid grid-cols-2 gap-2">
          <button
            type="button"
            role="radio"
            aria-label="Human"
            aria-checked={!isAI}
            data-state={!isAI ? "active" : "inactive"}
            onClick={() => onChange({ ...value, opponentType: PlayerTypes.HUMAN })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              !isAI
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <User className="size-3.5" aria-hidden="true" />
            Human
          </button>
          <button
            type="button"
            role="radio"
            aria-label="AI"
            aria-checked={isAI}
            data-state={isAI ? "active" : "inactive"}
            onClick={() => onChange({ ...value, opponentType: PlayerTypes.COMPUTER })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              isAI
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Bot className="size-3.5" aria-hidden="true" />
            AI
          </button>
        </div>
      </div>

      {/* AI difficulty — only when AI */}
      {isAI && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Difficulty
          </span>
          <AI_DifficultySelector
            selectedDifficulty={value.aiDifficulty}
            onDifficultyChange={(d) => onChange({ ...value, aiDifficulty: d })}
          />
        </div>
      )}

      <label htmlFor="sheet-opponent-name" className="block">
        <span className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="size-3.5" />
          Name
        </span>
        <input
          id="sheet-opponent-name"
          type="text"
          value={value.opponentName}
          placeholder={isAI ? "AI" : "Opponent"}
          onChange={(e) =>
            onChange({ ...value, opponentName: sanitizeDisplayName(e.target.value, isAI ? "AI" : "Opponent") })
          }
          maxLength={20}
          autoComplete="off"
          className="h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <ColorPicker
        label="Opponent color"
        shape={value.opponentShape}
        value={value.opponentColor}
        onChange={(nextColor) => onChange({ ...value, opponentColor: nextColor })}
      />

      <SymbolShapePicker
        value={value.opponentShape}
        onChange={(shape) => onChange({ ...value, opponentShape: shape })}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

export function PlayerSummaryCard({
  settings,
  gameMode,
  onEdit,
}: {
  settings: PlayerSettings;
  gameMode: GameModeValue;
  onEdit: () => void;
}) {
  const isOnline = gameMode === GameModes.ONLINE;
  const colorBg = COLOR_BG_CLASSES[settings.color];
  const shape = settings.playerShape;

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label="Edit your player settings"
      className="glass-interactive flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left"
      style={{ "--glass-sweep-color": COLOR_RGB[settings.color] } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
          colorBg,
        )}
      >
        <SymbolShapeRenderer shape={shape} strokeWidth={8} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold text-foreground">
          {settings.displayName || "You"}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {isOnline ? "Role assigned on connect" : "Random first move"}
        </span>
      </span>
      <Pencil className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
    </button>
  );
}

export function OpponentSummaryCard({
  opponentName,
  opponentColor,
  opponentShape,
  opponentType,
  aiDifficultyLabel,
  onEdit,
}: {
  opponentName: string;
  opponentColor: Color;
  opponentShape: SymbolShape;
  opponentType: PlayerType;
  aiDifficultyLabel?: string;
  onEdit: () => void;
}) {
  const isAI = opponentType === PlayerTypes.COMPUTER;
  const colorBg = COLOR_BG_CLASSES[opponentColor];
  const displayName = opponentName || (isAI ? "AI" : "Opponent");

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label="Edit opponent settings"
      className="glass-interactive flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left"
      style={{ "--glass-sweep-color": COLOR_RGB[opponentColor] } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
          colorBg,
        )}
      >
        <SymbolShapeRenderer shape={opponentShape} strokeWidth={8} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-base font-bold text-foreground">
          {isAI && <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          {displayName}
          {isAI && aiDifficultyLabel && (
            <span className="text-xs font-medium text-muted-foreground">
              ({aiDifficultyLabel.toLowerCase()})
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {isAI ? "Computer opponent" : "Pass and play"}
        </span>
      </span>
      <Pencil className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
    </button>
  );
}
