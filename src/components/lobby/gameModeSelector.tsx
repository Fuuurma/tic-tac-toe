import { useId } from "react";
import { GameModes, type GameMode } from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";
import { Bot, Check, Users, Wifi } from "lucide-react";

interface GameModeSelectorProps {
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

const MODES: {
  value: GameMode;
  label: string;
  shortLabel: string;
  description: string;
  Icon: typeof Bot;
}[] = [
  {
    value: GameModes.VS_COMPUTER,
    label: "vs Computer",
    shortLabel: "Computer",
    description: "Practice with AI",
    Icon: Bot,
  },
  {
    value: GameModes.VS_FRIEND,
    label: "vs Friend",
    shortLabel: "Friend",
    description: "Pass and play",
    Icon: Users,
  },
  { value: GameModes.ONLINE, label: "Online", shortLabel: "Online", description: "Play remotely", Icon: Wifi },
];

// Phones get a full-width radio-row list: three 3-up tiles left a 320px
// screen about 90px per tile, so the inline check crowded "Friend". From sm
// up the original tile grid returns unchanged.
export function GameModeSelector({ selectedMode, onModeChange }: GameModeSelectorProps) {
  const groupId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label="Game mode"
        className="flex flex-col gap-2 sm:grid sm:grid-cols-3"
        onKeyDown={handleRadioGroupKeyDown}
      >
        {MODES.map(({ value, label, shortLabel, description, Icon }) => {
          const active = selectedMode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-label={label}
              aria-describedby={`${groupId}-${value}-desc`}
              aria-checked={active}
              data-state={active ? "active" : "inactive"}
              tabIndex={active ? 0 : -1}
              onClick={() => onModeChange(value)}
              className={cn(
                "group flex min-h-14 flex-col items-stretch justify-center gap-1 rounded-lg border px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:min-h-[4.5rem] sm:gap-1.5 sm:px-2.5 sm:py-2.5",
                active
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span className="flex items-center justify-between gap-2 sm:gap-1">
                <span className="flex min-w-0 items-center gap-2 sm:gap-1.5">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold sm:text-xs">{shortLabel}</span>
                </span>
                {active && (
                  <Check
                    className="size-4 shrink-0 text-[rgb(var(--player-color))] sm:size-3.5"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                id={`${groupId}-${value}-desc`}
                className="text-sm leading-tight text-foreground/80 sm:text-[11px]"
              >
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
