import {
  AVAILABLE_COLORS,
  COLOR_BG_CLASSES,
  type Color,
} from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { getColorLabel } from "@/i18n/language";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  /** Accessible name for the radiogroup (the visible label lives on the dropdown trigger). */
  label: string;
  value: Color;
  onChange: (color: Color) => void;
}

const formatColorName = (color: Color) => getColorLabel(color);

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
              // No check mark: the swatch itself is the selection signal —
              // full opacity plus contour (ring) plus a slight lift. The
              // unselected swatches sit back at reduced opacity.
              "flex h-12 items-center justify-center rounded-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-8px_14px_-10px_rgba(0,0,0,0.4)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              COLOR_BG_CLASSES[color],
              isSelected
                ? "scale-105 ring-2 ring-[rgb(var(--player-color))] ring-offset-2 ring-offset-background"
                : "opacity-70 hover:scale-[1.02] hover:opacity-100",
            )}
          />
        );
      })}
    </div>
  );
}
