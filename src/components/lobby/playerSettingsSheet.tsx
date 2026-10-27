import { useId, type CSSProperties, type ReactNode } from "react";
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
import { LanguageSwitcher } from "./languageSwitcher";
import { ThemeSegmented } from "./themeToggle";
import { t, useStrings } from "@/i18n/language";
import { AI_DifficultySelector } from "./aiDifficultySelector";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";
import { Bot, ChevronRight, Pencil, Settings2, User } from "lucide-react";
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

export type SettingsTab = "player" | "opponent" | "app";

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
  /**
   * Identity is host-owned in an online room: the host assigns the symbols, so
   * a guest gets no You/Opponent tabs. Theme, language and help are local and
   * stay available to both, which is why this gates the tabs and not the sheet.
   */
  canEditIdentity: boolean;
  onHowToPlay: () => void;
  onReplayTutorial?: () => void;
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
  canEditIdentity,
  onHowToPlay,
  onReplayTutorial,
}: SettingsSheetProps) {
  const sheetId = useId();

  // Subscribes so a language switch re-renders the sheet.
  useStrings();
  const showOpponentTab = canEditIdentity && gameMode !== GameModes.ONLINE;
  const tabs = [
    ...(canEditIdentity
      ? [{ id: "player" as const, label: t("settings.you"), Icon: User }]
      : []),
    ...(showOpponentTab
      ? [
          {
            id: "opponent" as const,
            label: t("settings.opponent"),
            Icon: opponent.opponentType === PlayerTypes.COMPUTER ? Bot : User,
          },
        ]
      : []),
    { id: "app" as const, label: t("settings.app"), Icon: Settings2 },
  ];
  // A guest in an online room has exactly one tab, and a one-item strip is
  // chrome answering a question nobody asked.
  const showStrip = tabs.length > 1;
  const active = tabs.some((entry) => entry.id === tab) ? tab : tabs[0].id;
  const activeColor = active === "opponent" ? opponent.opponentColor : player.color;
  const panelId = (id: SettingsTab) => `${sheetId}-panel-${id}`;

  // The Sheet stays mounted so its dialog runs showModal and focus restore on
  // open and close. The form mounts only while open, so a closed sheet never
  // leaves a second copy of the name inputs in the DOM.
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t("settings.title")}
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
          {showStrip && (
            <div
              role="tablist"
              aria-label={t("settings.tabs")}
              className="flex shrink-0 gap-2"
              onKeyDown={handleTabListKeyDown}
            >
              {tabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active === id}
                  aria-controls={panelId(id)}
                  tabIndex={active === id ? 0 : -1}
                  onClick={() => onTabChange(id)}
                  className={cn(
                    "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-bold max-sm:h-12 max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    pickerTileClass(active === id),
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          )}
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
          {active === "app" && (
            <div
              role="tabpanel"
              id={panelId("app")}
              className="flex flex-col gap-5 max-sm:gap-6"
            >
              <AppTab onHowToPlay={onHowToPlay} onReplayTutorial={onReplayTutorial} />
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

/* ------------------------------------------------------------------ */
/* App tab: the preferences that are not about a player                */
/* ------------------------------------------------------------------ */

/**
 * One setting, one row: label left, control right, hairline under it.
 *
 * The two global preferences used to be 44px icon buttons in the You tab, so
 * their state was inferred from a glyph and both lived in a form that is about
 * a player rather than about the app. A row states the setting; the control
 * states its value.
 */
function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      {children}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <h3 className="m-0 mb-1 text-xs font-semibold text-muted-foreground">{label}</h3>
      {children}
    </div>
  );
}

/** A row whose whole width is the action. */
function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border/60 text-left text-sm font-semibold text-foreground transition-colors last:border-b-0 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
    >
      {label}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function AppTab({
  onHowToPlay,
  onReplayTutorial,
}: {
  onHowToPlay: () => void;
  onReplayTutorial?: () => void;
}) {
  return (
    <>
      <Group label={t("settings.appearance")}>
        <Row>
          <ThemeSegmented />
        </Row>
      </Group>
      <Group label={t("settings.language")}>
        <Row>
          <LanguageSwitcher />
        </Row>
      </Group>
      <Group label={t("settings.learn")}>
        <LinkRow label={t("settings.howToPlay")} onClick={onHowToPlay} />
        {onReplayTutorial && (
          <LinkRow label={t("help.replay")} onClick={onReplayTutorial} />
        )}
      </Group>
    </>
  );
}
