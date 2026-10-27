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
  type PlayerSettings,
  COLOR_MARK_TEXT,
} from "@/game/constants";
import { Sheet } from "@/components/ui/sheet";
import { AppearancePickers } from "./appearancePickers";
import { t, useStrings } from "@/i18n/language";
import { AI_DifficultySelector } from "./aiDifficultySelector";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";
import { Bot, Pencil, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterDisplayNameInput } from "@/lib/identity";
import { handleRadioGroupKeyDown, handleTabListKeyDown } from "@/lib/radioGroup";
import { pickerTileClass } from "@/lib/pickerClasses";

type GameModeValue =
  | typeof GameModes.VS_COMPUTER
  | typeof GameModes.VS_FRIEND
  | typeof GameModes.ONLINE;

export type { PlayerSettings };

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
  const sheetId = useId();

  // Subscribes so a language switch re-renders the sheet.
  useStrings();
  // An online room has no opponent to describe: the relay seats them and the
  // host cannot edit their identity, so the second tab does not exist there.
  const showOpponentTab = gameMode !== GameModes.ONLINE;
  const active = tab === "opponent" && !showOpponentTab ? "player" : tab;
  const activeColor = active === "opponent" ? opponent.opponentColor : player.color;
  const panelId = (id: SettingsTab) => `${sheetId}-panel-${id}`;

  // The Sheet stays mounted so its dialog runs showModal and focus restore on
  // open and close. The form mounts only while open, so a closed sheet never
  // leaves a second copy of the name inputs in the DOM.
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t("settings.playersTitle")}
      // Content-height bottom sheet on phones: the form is short (tabs +
      // name + pickers), so a full-height page left a dead middle. Auto
      // pins the sheet to the content with the game visible behind it.
      size="auto"
      compactMobile
      bodyClassName="max-sm:gap-6"
      style={{ "--player-color": COLOR_RGB[activeColor] } as CSSProperties}
    >
      {isOpen && (
        <>
          <div
            role="tablist"
            aria-label={t("settings.tabs")}
            className="flex shrink-0 gap-2"
            onKeyDown={handleTabListKeyDown}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active === "player"}
              aria-controls={panelId("player")}
              tabIndex={active === "player" ? 0 : -1}
              onClick={() => onTabChange("player")}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                pickerTileClass(active === "player"),
              )}
            >
              <User className="size-3.5" aria-hidden="true" />
              {t("settings.you")}
            </button>
            {showOpponentTab && (
              <button
                type="button"
                role="tab"
                aria-selected={active === "opponent"}
                aria-controls={panelId("opponent")}
                tabIndex={active === "opponent" ? 0 : -1}
                onClick={() => onTabChange("opponent")}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  pickerTileClass(active === "opponent"),
                )}
              >
                {opponent.opponentType === PlayerTypes.COMPUTER ? (
                  <Bot className="size-3.5" aria-hidden="true" />
                ) : (
                  <User className="size-3.5" aria-hidden="true" />
                )}
                {t("settings.opponent")}
              </button>
            )}
          </div>
          {active === "player" && (
            <div
              role="tabpanel"
              id={panelId("player")}
              className="flex flex-col gap-5 max-sm:gap-6"
            >
              <PlayerTab
                isOnline={gameMode === GameModes.ONLINE}
                value={player}
                onChange={onPlayerChange}
              />
            </div>
          )}
          {active === "opponent" && showOpponentTab && (
            <div
              role="tabpanel"
              id={panelId("opponent")}
              className="flex flex-col gap-5 max-sm:gap-6"
            >
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
        label={t("settings.name")}
        value={value.displayName}
        onChange={(displayName) => onChange({ ...value, displayName })}
      />

      <AppearancePickers
        colorLabel={t("settings.color")}
        shapeLabel={t("settings.symbol")}
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
      <div role="group" aria-label={t("settings.opponentType")} className="flex flex-col gap-2">
        <span className="hidden text-sm font-semibold max-sm:block">{t("settings.playsAs")}</span>
        <div
          role="radiogroup"
          aria-label={t("settings.opponentType")}
          className="grid grid-cols-2 gap-2"
          onKeyDown={handleRadioGroupKeyDown}
        >
          <button
            type="button"
            role="radio"
            aria-label={t("settings.ai")}
            aria-checked={isAI}
            data-state={isAI ? "active" : "inactive"}
            tabIndex={isAI ? 0 : -1}
            onClick={() => onChange({ ...value, opponentType: PlayerTypes.COMPUTER })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              pickerTileClass(isAI),
            )}
          >
            <Bot className="size-3.5" aria-hidden="true" />
            {t("settings.ai")}
          </button>
          <button
            type="button"
            role="radio"
            aria-label={t("settings.human")}
            aria-checked={!isAI}
            data-state={!isAI ? "active" : "inactive"}
            tabIndex={!isAI ? 0 : -1}
            onClick={() => onChange({ ...value, opponentType: PlayerTypes.HUMAN })}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              pickerTileClass(!isAI),
            )}
          >
            <User className="size-3.5" aria-hidden="true" />
            {t("settings.human")}
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
        label={t("settings.opponentName")}
        value={value.opponentName}
        onChange={(opponentName) => onChange({ ...value, opponentName })}
      />

      <AppearancePickers
        colorLabel={t("settings.opponentColor")}
        shapeLabel={t("settings.opponentSymbol")}
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
          {settings.displayName || t("settings.youFallback")}
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
      aria-label={t("settings.editPlayer")}
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
  const displayName = opponentName || (isAI ? t("settings.aiFallback") : t("settings.opponentFallback"));

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t("settings.editOpponent")}
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
