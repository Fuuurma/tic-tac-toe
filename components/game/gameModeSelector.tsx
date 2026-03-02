import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GameModes, GAME_MODES } from "@/app/game/constants/constants";
import { Monitor, Globe, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface GameModeOption {
  id: GameModes;
  label: string;
  description: string;
}

interface GameModeSelectorProps {
  selectedMode: GameModes;
  onModeChange: (mode: GameModes) => void;
  gameModeOptions?: GameModeOption[];
}

const getModeIcon = (mode: GameModes) => {
  switch (mode) {
    case GameModes.VS_COMPUTER:
      return Monitor;
    case GameModes.ONLINE:
      return Globe;
    case GameModes.VS_FRIEND:
      return Users;
    default:
      return Monitor;
  }
};

const defaultGameModes = Object.values(GAME_MODES);

export const GameModeSelector: React.FC<GameModeSelectorProps> = React.memo(
  ({ selectedMode, onModeChange, gameModeOptions = defaultGameModes }) => {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Game Mode</Label>
        <RadioGroup
          value={selectedMode}
          onValueChange={(value) => onModeChange(value as GameModes)}
          className="grid grid-cols-1 gap-1"
        >
          {gameModeOptions.map((mode) => {
            const Icon = getModeIcon(mode.id);
            const isSelected = selectedMode === mode.id;
            
            return (
              <div key={mode.id}>
                <RadioGroupItem
                  value={mode.id}
                  id={mode.id}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={mode.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all duration-200",
                    "hover:bg-accent/50 hover:border-accent",
                    isSelected 
                      ? "border-primary bg-primary/10 ring-1 ring-primary" 
                      : "border-border"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-md",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{mode.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {mode.description}
                    </div>
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>
    );
  }
);

GameModeSelector.displayName = "GameModeSelector";
