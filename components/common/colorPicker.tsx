import React from "react";
import { COLOR_VARIANTS, Color } from "@/app/game/constants/constants";
import capitalizeFirstLetter from "@/app/utils/capitalize";

interface ColorPickerProps {
  selectedColor: Color | null;
  onColorSelect: (color: Color) => void;
  disabledColor?: Color | null;
  availableColors?: Record<Color, { bg: string; border: string }>;
}

const defaultColors = COLOR_VARIANTS;

const SWATCH_COLORS: Record<Color, string> = {
  [Color.BLUE]: "#2563eb",
  [Color.GREEN]: "#16a34a",
  [Color.YELLOW]: "#eab308",
  [Color.ORANGE]: "#f97316",
  [Color.RED]: "#dc2626",
  [Color.PINK]: "#db2777",
  [Color.PURPLE]: "#9333ea",
  [Color.GRAY]: "#64748b",
};

export const ColorPicker: React.FC<ColorPickerProps> = React.memo(
  ({
    selectedColor,
    onColorSelect,
    disabledColor = null,
    availableColors = defaultColors,
  }) => {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(availableColors).map(([colorKey, colorValue]) => {
          const color = colorKey as Color;
          const isDisabled = color === disabledColor;
          const isSelected = color === selectedColor;

          return (
            <button
              key={color}
              type="button" // Add type="button" to prevent form submission
              disabled={isDisabled}
              className={`
                h-7 w-7 rounded-full border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-8 sm:w-8
                ${colorValue.border}
                ${
                  isSelected
                    ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                    : ""
                }
                ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}
                ${!isSelected && !isDisabled ? "hover:scale-105" : ""}
              `}
              style={{ backgroundColor: SWATCH_COLORS[color] }}
              onClick={() => !isDisabled && onColorSelect(color)}
              title={capitalizeFirstLetter(color)}
              aria-label={`Select color ${capitalizeFirstLetter(color)}${
                isDisabled ? " (disabled)" : ""
              }`}
              aria-pressed={isSelected}
            />
          );
        })}
      </div>
    );
  }
);

ColorPicker.displayName = "ColorPicker";
