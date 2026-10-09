import { AVAILABLE_SHAPES, SHAPE_LABELS, SymbolShape } from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";

interface SymbolShapePickerProps {
  /** Accessible name for the radiogroup (the visible label lives on the dropdown trigger). */
  label: string;
  value: SymbolShape;
  onChange: (shape: SymbolShape) => void;
}

export function SymbolShapePicker({
  label,
  value,
  onChange,
}: SymbolShapePickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-4 gap-2"
      onKeyDown={handleRadioGroupKeyDown}
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
            title={label}
            data-state={isSelected ? "active" : "inactive"}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(shape)}
            className={cn(
              "flex h-12 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
              isSelected
                ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <SymbolShapeRenderer
              shape={shape}
              strokeWidth={8}
              className={cn(
                "size-8",
                isSelected ? "text-[rgb(var(--player-color))]" : "text-current",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
