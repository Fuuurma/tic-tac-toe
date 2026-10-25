import { GameModes, type GameMode } from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";
import { Bot, Users, Wifi } from "lucide-react";

interface GameModeSelectorProps {
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
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
export function GameModeSelector({ selectedMode, onModeChange }: GameModeSelectorProps) {
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
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-label={label}
              aria-checked={active}
              data-state={active ? "active" : "inactive"}
              tabIndex={active ? 0 : -1}
              onClick={() => onModeChange(value)}
              className={cn(
                // No check mark: the tile itself is the selection signal —
                // contour (ring-2), highlight (tinted fill), and the icon
                // taking the player color. Content stays centered.
                "group flex min-h-14 flex-col items-stretch justify-center gap-1 rounded-lg border px-3.5 py-3 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:min-h-[4.5rem] sm:gap-1.5 sm:px-2.5 sm:py-2.5",
                active
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.15)] text-foreground shadow-md ring-2 ring-[rgb(var(--player-color)/0.35)]"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
