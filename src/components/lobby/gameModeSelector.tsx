import { GameModes, type GameMode } from "@/game/constants";
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

export function GameModeSelector({ selectedMode, onModeChange }: GameModeSelectorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-label="Game mode"
        className="grid grid-cols-3 gap-2"
      >
      {MODES.map(({ value, label, shortLabel, description, Icon }) => {
        const active = selectedMode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-label={label}
            aria-checked={active}
            data-state={active ? "active" : "inactive"}
            onClick={() => onModeChange(value)}
            className={cn(
              "group flex min-h-[4.5rem] flex-col items-stretch justify-center gap-1.5 rounded-lg border px-2.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              active
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <span className="flex items-center justify-between gap-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate text-xs font-semibold">{shortLabel}</span>
              </span>
              {active && <Check className="size-3.5 shrink-0 text-[rgb(var(--player-color))]" aria-hidden="true" />}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {description}
            </span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
