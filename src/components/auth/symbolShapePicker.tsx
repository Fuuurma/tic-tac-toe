import { AVAILABLE_SHAPES, SHAPE_LABELS, SymbolShape } from "@/game/constants";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";

interface SymbolShapePickerProps {
  value: SymbolShape;
  disabled?: boolean;
  onChange: (shape: SymbolShape) => void;
}

export function SymbolShapePicker({
  value,
  disabled = false,
  onChange,
}: SymbolShapePickerProps) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Your shape
      </legend>
      <div
        role="radiogroup"
        aria-label="Your shape"
        className="grid grid-cols-4 gap-2"
      >
        {AVAILABLE_SHAPES.map((shape) => {
          const isSelected = value === shape;
          const label = SHAPE_LABELS[shape];

          return (
            <button
              key={shape}
              type="button"
              role="radio"
              aria-label={label}
              aria-checked={isSelected}
              data-state={isSelected ? "active" : "inactive"}
              onClick={() => onChange(shape)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
                isSelected
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <SymbolShapeRenderer
                shape={shape}
                strokeWidth={8}
                className={cn(
                  "h-7 w-7",
                  isSelected ? "text-[rgb(var(--player-color))]" : "text-current",
                )}
              />
            </button>
          );
        })}
      </div>
      {disabled && (
        <p className="text-xs leading-tight text-muted-foreground">
          Online rooms assign your shape when you connect.
        </p>
      )}
    </fieldset>
  );
}
