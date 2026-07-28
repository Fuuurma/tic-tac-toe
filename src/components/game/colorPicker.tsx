import { COLOR_BG_CLASSES, AVAILABLE_COLORS, type Color, type SymbolShape } from "@/game/constants";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "./symbolShapeRenderer";

interface ColorPickerProps {
  label: string;
  shape: SymbolShape;
  value: Color;
  onChange: (color: Color) => void;
}

const formatColorName = (color: Color) => color.charAt(0).toUpperCase() + color.slice(1);

export function ColorPicker({
  label,
  shape,
  value,
  onChange,
}: ColorPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span
            aria-hidden="true"
            className="glass-cell flex size-5 items-center justify-center rounded text-foreground"
          >
            <SymbolShapeRenderer shape={shape} strokeWidth={12} className="h-3 w-3" />
          </span>
          {label}
        </span>
        <span className="text-xs font-semibold text-foreground">{formatColorName(value)}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {AVAILABLE_COLORS.map((color) => {
          const isSelected = value === color;
          const colorName = formatColorName(color);

          return (
            <button
              key={color}
              type="button"
              data-color={color}
              aria-label={`${colorName} color${isSelected ? ", selected" : ""}`}
              aria-pressed={isSelected}
              title={colorName}
              onClick={() => onChange(color)}
              className={cn(
                "flex min-h-9 items-center justify-between gap-1 rounded-lg border px-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 sm:px-2 sm:text-xs",
                isSelected
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground ring-2 ring-[rgb(var(--player-color)/0.3)]"
                  : "border-border/70 bg-background/50 hover:border-[rgb(var(--player-color)/0.6)] hover:bg-muted/40",
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("size-3.5 shrink-0 rounded-full border border-black/10", COLOR_BG_CLASSES[color])}
                />
                <span className="truncate">{colorName}</span>
              </span>
              {isSelected && (
                <span aria-hidden="true" className="shrink-0 text-[rgb(var(--player-color))]">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
