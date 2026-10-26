import { useId, useState } from "react";
import { GameModes, type GameMode } from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";
import { Bot, TriangleAlert, Users, Wifi } from "lucide-react";

interface GameModeSelectorProps {
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  /** Modes that cannot be used right now, each with the reason shown on
      the tile. A disabled tile never selects: no click, no keyboard path
      (the shared radiogroup handler skips disabled radios). */
  disabledModes?: Partial<Record<GameMode, string>>;
}

const MODES: {
  value: GameMode;
  label: string;
  shortLabel: string;
  Icon: typeof Bot;
}[] = [
  {
    value: GameModes.VS_COMPUTER,
    label: "vs Computer",
    shortLabel: "Computer",
    Icon: Bot,
  },
  {
    value: GameModes.VS_FRIEND,
    label: "vs Friend",
    shortLabel: "Friend",
    Icon: Users,
  },
  { value: GameModes.ONLINE, label: "Online", shortLabel: "Online", Icon: Wifi },
];

// Phones get a full-width radio-row list: three 3-up tiles left a 320px
// screen about 90px per tile, so the inline check crowded "Friend". From sm
// up the original tile grid returns unchanged.
export function GameModeSelector({
  selectedMode,
  onModeChange,
  disabledModes,
}: GameModeSelectorProps) {
  const reasonId = useId();
  // Which disabled tile the visitor tapped: its reason shows on demand,
  // centered inside the tile itself. Tapping another mode clears it.
  const [explained, setExplained] = useState<GameMode | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label="Game mode"
        className="flex flex-col gap-2 sm:grid sm:grid-cols-3"
        onKeyDown={handleRadioGroupKeyDown}
      >
        {MODES.map(({ value, label, shortLabel, Icon }) => {
          const active = selectedMode === value;
          const reason = disabledModes?.[value];
          // aria-disabled (not disabled) keeps the tile perceivable: hover
          // shows the reason via title, tap/Enter reveals it below, and the
          // tile stays out of the arrow-key path (shared radiogroup helper
          // skips aria-disabled). tabIndex 0 is a deliberate second tab
          // stop so keyboard users can discover why the mode is off.
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-label={label}
              aria-checked={active}
              data-state={active ? "active" : "inactive"}
              tabIndex={reason ? 0 : active ? 0 : -1}
              aria-disabled={reason ? true : undefined}
              aria-describedby={reason && explained === value ? reasonId : undefined}
              title={reason}
              onClick={() => {
                if (reason) {
                  setExplained((cur) => (cur === value ? null : value));
                } else {
                  setExplained(null);
                  onModeChange(value);
                }
              }}
              className={cn(
                // No check mark: the tile itself is the selection signal —
                // contour (ring-2), highlight (tinted fill), and the icon
                // taking the player color. Content stays centered.
                "group relative flex min-h-14 w-full flex-col items-stretch justify-center gap-1 rounded-lg border px-3.5 py-3 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:min-h-[4.5rem] sm:gap-1.5 sm:px-2.5 sm:py-2.5",
                reason
                  ? "cursor-not-allowed border-border/50 bg-background/30 text-muted-foreground/60 opacity-70"
                  : active
                    ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.15)] text-foreground shadow-md ring-2 ring-[rgb(var(--player-color)/0.35)]"
                    : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {reason && (
                <TriangleAlert
                  className="absolute top-1.5 right-1.5 size-4 text-amber-500 dark:text-amber-400"
                  aria-hidden="true"
                />
              )}
              <span className="flex items-center justify-center gap-2 sm:flex-col sm:gap-1.5">
                <Icon
                  className={cn(
                    "size-5 shrink-0 transition-colors duration-200",
                    active && "text-[rgb(var(--player-color))]",
                  )}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold sm:text-xs">{shortLabel}</span>
              </span>
              {reason && explained === value && (
                <span
                  id={reasonId}
                  role="status"
                  className="px-1 text-center text-xs text-muted-foreground"
                >
                  {reason}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
