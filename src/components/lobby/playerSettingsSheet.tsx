import { useId, type CSSProperties } from "react";
import {
  COLOR_BG_CLASSES,
  COLOR_RGB,
  Color,
  GameModes,
  PlayerTypes,
  SymbolShape,
  type AI_Difficulty as AI_DifficultyType,
  type PlayerType,
  COLOR_MARK_TEXT,
} from "@/game/constants";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { AppearancePickers } from "./appearancePickers";
import { AI_DifficultySelector } from "./aiDifficultySelector";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";
import { Bot, Pencil, Play, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterDisplayNameInput } from "@/lib/identity";
import { handleRadioGroupKeyDown, handleTabListKeyDown } from "@/lib/radioGroup";

type GameModeValue =
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
  onStart?: () => void;
  startLabel?: string;
  startDisabled?: boolean;
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
  onStart,
  startLabel,
  startDisabled,
}: SettingsSheetProps) {
  const sheetId = useId();
  const playerPanelId = `${sheetId}-panel-player`;
  const opponentPanelId = `${sheetId}-panel-opponent`;

  const isOnline = gameMode === GameModes.ONLINE;
  const showOpponentTab = !isOnline;
  const activeColor = tab === "opponent" ? opponent.opponentColor : player.color;

  // The Sheet stays mounted so its dialog runs showModal and focus restore on
  // open and close. The form mounts only while open, so a closed sheet never
  // leaves a second copy of the name inputs in the DOM.
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title="Settings"
      // Content-height bottom sheet on phones: the form is short (tabs +
      // name + pickers), so a full-height page left a dead middle. Auto
      // pins the sheet to the content with the game visible behind it.
      size="auto"
      bodyClassName="max-sm:gap-6"
      style={{ "--player-color": COLOR_RGB[activeColor] } as CSSProperties}
      footer={
        isOpen && onStart ? (
          <Button
            type="button"
            size="lg"
            variant="glass"
            disabled={startDisabled}
            onClick={onStart}
            className={cn(
              "h-12 w-full shrink-0 text-base font-bold sm:h-14",
              startDisabled && "cursor-not-allowed opacity-50",
            )}
            style={
              {
                "--glass-sweep-color": COLOR_RGB[activeColor],
                "--glass-tint": COLOR_RGB[activeColor],
                "--glass-alpha": "0.15",
                "--glass-sheen": COLOR_RGB[activeColor],
                "--glass-sheen-alpha": "0.25",
              } as CSSProperties
            }
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            {startLabel ?? "Start Game"}
          </Button>
        ) : isOpen ? (
          // In-game edits apply live, so there is nothing to submit; phones
          // still get a dismiss in thumb reach instead of only the top-corner X.
          <Button type="button" size="lg" variant="glass" onClick={onClose} className="h-12 w-full text-base font-semibold sm:hidden">
            Done
          </Button>
        ) : undefined
      }
      footerClassName={onStart ? undefined : "sm:hidden"}
    >
      {isOpen && (
        <>
          <div
            role="tablist"
            aria-label="Settings tabs"
            className="flex shrink-0 gap-2"
            onKeyDown={handleTabListKeyDown}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "player"}
              aria-controls={playerPanelId}
              tabIndex={tab === "player" ? 0 : -1}
              onClick={() => onTabChange("player")}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
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
                tabIndex={tab === "opponent" ? 0 : -1}
                onClick={() => onTabChange("opponent")}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  tab === "opponent"
                    ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm"
                    : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {opponent.opponentType === PlayerTypes.COMPUTER ? (
                  <Bot className="size-3.5" aria-hidden="true" />
                ) : (
                  <User className="size-3.5" aria-hidden="true" />
                )}
                Opponent
              </button>
            )}
          </div>

          {tab === "player" && (
            <div role="tabpanel" id={playerPanelId} className="flex flex-col gap-5 max-sm:gap-6">
              <PlayerTab isOnline={isOnline} value={player} onChange={onPlayerChange} />
            </div>
          )}
          {tab === "opponent" && showOpponentTab && (
            <div role="tabpanel" id={opponentPanelId} className="flex flex-col gap-5 max-sm:gap-6">
              <OpponentTab value={opponent} onChange={onOpponentChange} />
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Shared name field                                                   */
/* ------------------------------------------------------------------ */

// Name fields are typed on phones with a keyboard that should not autocorrect
// or capitalise every word of a handle. text-field keeps 16px so iOS does not zoom.
function NameField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="relative">
      <User
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id={id}
        type="text"
        value={value}
        placeholder={label}
        aria-label={label}
        onChange={(e) => onChange(filterDisplayNameInput(e.target.value))}
        maxLength={20}
        autoComplete="off"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        className="h-12 w-full rounded-lg border border-input bg-background/60 pl-9 pr-3 text-field outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      />
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
      <NameField
        id="sheet-name"
        label="Your name"
        value={value.displayName}
        onChange={(displayName) => onChange({ ...value, displayName })}
      />

      <AppearancePickers
        colorLabel="Your color"
        shapeLabel="Your symbol"
        color={value.color}
        shape={value.playerShape}
        shapeDisabled={isOnline}
        onColorChange={(nextColor) => onChange({ ...value, color: nextColor })}
        onShapeChange={(shape) => onChange({ ...value, playerShape: shape })}
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
      {/* AI first to match the lobby game-mode order. The tab already says
          "Opponent", so this group names what is being chosen. */}
      <div role="group" aria-label="Opponent type" className="flex flex-col gap-2">
        <span className="hidden text-sm font-semibold max-sm:block">Plays as</span>
        <div
          role="radiogroup"
          aria-label="Opponent type"
          className="grid grid-cols-2 gap-2"
          onKeyDown={handleRadioGroupKeyDown}
        >
          <button
            type="button"
            role="radio"
            aria-label="AI"
            aria-checked={isAI}
            data-state={isAI ? "active" : "inactive"}
            tabIndex={isAI ? 0 : -1}
            onClick={() => onChange({ ...value, opponentType: PlayerTypes.COMPUTER })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              isAI
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Bot className="size-3.5" aria-hidden="true" />
            AI
          </button>
          <button
            type="button"
            role="radio"
            aria-label="Human"
            aria-checked={!isAI}
            data-state={!isAI ? "active" : "inactive"}
            tabIndex={!isAI ? 0 : -1}
            onClick={() => onChange({ ...value, opponentType: PlayerTypes.HUMAN })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              !isAI
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <User className="size-3.5" aria-hidden="true" />
            Human
          </button>
        </div>
      </div>

      {isAI && (
        <AI_DifficultySelector
          selectedDifficulty={value.aiDifficulty}
          onDifficultyChange={(d) => onChange({ ...value, aiDifficulty: d })}
        />
      )}

      <NameField
        id="sheet-opponent-name"
        label="Opponent name"
        value={value.opponentName}
        onChange={(opponentName) => onChange({ ...value, opponentName })}
      />

      <AppearancePickers
        colorLabel="Opponent color"
        shapeLabel="Opponent symbol"
        color={value.opponentColor}
        shape={value.opponentShape}
        onColorChange={(nextColor) => onChange({ ...value, opponentColor: nextColor })}
        onShapeChange={(shape) => onChange({ ...value, opponentShape: shape })}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

export function PlayerSummaryCard({
  settings,
  onEdit,
}: {
  settings: PlayerSettings;
  onEdit?: () => void;
}) {
  const colorBg = COLOR_BG_CLASSES[settings.color];
  const shape = settings.playerShape;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-md",
          COLOR_MARK_TEXT[settings.color],
          colorBg,
        )}
      >
        <SymbolShapeRenderer shape={shape} strokeWidth={8} className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold text-foreground">
          {settings.displayName || "You"}
        </span>
      </span>
      {onEdit && <Pencil className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />}
    </>
  );

  if (!onEdit) {
    return (
      <div
        className="glass flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5"
        style={{ "--glass-sweep-color": COLOR_RGB[settings.color] } as React.CSSProperties}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label="Edit your player settings"
      className="glass-interactive flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5 text-left"
      style={{ "--glass-sweep-color": COLOR_RGB[settings.color] } as React.CSSProperties}
    >
      {content}
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
          "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-md",
          COLOR_MARK_TEXT[opponentColor],
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
              ({aiDifficultyLabel})
            </span>
          )}
        </span>
      </span>
      <Pencil className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
    </button>
  );
}
