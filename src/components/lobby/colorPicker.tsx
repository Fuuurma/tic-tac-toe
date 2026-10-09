import { Check } from "lucide-react";
import {
  AVAILABLE_COLORS,
  COLOR_BG_CLASSES,
  COLOR_MARK_TEXT,
  type Color,
} from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  /** Accessible name for the radiogroup (the visible label lives on the dropdown trigger). */
  label: string;
  value: Color;
  onChange: (color: Color) => void;
}

const formatColorName = (color: Color) => color.charAt(0).toUpperCase() + color.slice(1);

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-4 gap-2"
      onKeyDown={handleRadioGroupKeyDown}
    >
      {AVAILABLE_COLORS.map((color) => {
        const isSelected = value === color;
        const colorName = formatColorName(color);

        return (
          <button
            key={color}
            type="button"
            role="radio"
            data-color={color}
            aria-label={colorName}
            aria-checked={isSelected}
            title={colorName}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(color)}
            className={cn(
              "flex h-12 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_14px_-10px_rgba(0,0,0,0.4)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              COLOR_BG_CLASSES[color],
              isSelected
                ? "ring-2 ring-[rgb(var(--player-color))] ring-offset-2 ring-offset-background"
                : "opacity-80 hover:opacity-100",
            )}
          >
            {isSelected && (
              <Check
                className={cn("size-5", COLOR_MARK_TEXT[color])}
                strokeWidth={3}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
