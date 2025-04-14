import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GameModes, GAME_MODES } from "@/app/game/constants/constants";

interface GameModeOption {
  id: GameModes;
  label: string;
  description: string;
}

interface GameModeSelectorProps {
  selectedMode: GameModes;
  onModeChange: (mode: GameModes) => void;
  gameModeOptions?: GameModeOption[]; // Make it configurable
}

const defaultGameModes = Object.values(GAME_MODES); // Get array of mode objects

export const GameModeSelector: React.FC<GameModeSelectorProps> = React.memo(
  ({ selectedMode, onModeChange, gameModeOptions = defaultGameModes }) => {
    return (
      <div className="space-y-3 pt-2">
        <Label>Game Mode</Label>
        <RadioGroup
          value={selectedMode}
          onValueChange={(value) => onModeChange(value as GameModes)}
          aria-label="Select Game Mode"
        >
          {gameModeOptions.map((mode) => (
            <div key={mode.id} className="flex items-start space-x-3 py-2">
              <RadioGroupItem value={mode.id} id={mode.id} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor={mode.id} className="font-medium cursor-pointer">
                  {mode.label}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {mode.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }
);

GameModeSelector.displayName = "GameModeSelector";
