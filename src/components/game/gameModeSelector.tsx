import { GameModes, type GameMode } from "@/game/constants";
import { cn } from "@/lib/utils";
import { Bot, Users, Wifi } from "lucide-react";

interface GameModeSelectorProps {
  selectedMode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

const MODES: { value: GameMode; label: string; Icon: typeof Bot }[] = [
  { value: GameModes.VS_COMPUTER, label: "vs Computer", Icon: Bot },
  { value: GameModes.VS_FRIEND, label: "vs Friend", Icon: Users },
  { value: GameModes.ONLINE, label: "Online", Icon: Wifi },
];

export function GameModeSelector({ selectedMode, onModeChange }: GameModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Game mode"
      className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1"
    >
      {MODES.map(({ value, label, Icon }) => {
        const active = selectedMode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-label={label}
            aria-checked={active}
            onClick={() => onModeChange(value)}
            className={cn(
              "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition sm:text-sm",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label.split(" ")[1] ?? label}</span>
          </button>
        );
      })}
    </div>
  );
}
