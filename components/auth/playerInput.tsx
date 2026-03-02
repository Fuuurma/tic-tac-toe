import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Color } from "@/app/game/constants/constants";
import { ColorPicker } from "../common/colorPicker";

interface PlayerInputSectionProps {
  idPrefix: string;
  title: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  usernameValue: string;
  onUsernameChange: (value: string) => void;
  colorLabel: string;
  selectedColor: Color;
  onColorChange: (color: Color) => void;
  disabledColor?: Color | null;
  Icon: React.ElementType;
}

export const PlayerInputSection: React.FC<PlayerInputSectionProps> = React.memo(
  ({
    idPrefix,
    title,
    usernameLabel,
    usernamePlaceholder,
    usernameValue,
    onUsernameChange,
    colorLabel,
    selectedColor,
    onColorChange,
    disabledColor,
    Icon,
  }) => {
    const usernameId = `${idPrefix}-username`;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={usernameId} className="text-xs">{usernameLabel}</Label>
            <Input
              id={usernameId}
              type="text"
              value={usernameValue}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder={usernamePlaceholder}
              className="w-full h-8"
              aria-label={usernameLabel}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{colorLabel}</Label>
            <ColorPicker
              selectedColor={selectedColor}
              onColorSelect={onColorChange}
              disabledColor={disabledColor}
            />
          </div>
        </div>
      </div>
    );
  }
);

PlayerInputSection.displayName = "PlayerInputSection";
