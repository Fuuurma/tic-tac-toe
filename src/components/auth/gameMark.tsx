import { SymbolShape } from "@/game/constants";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";

const MARKS: (SymbolShape | null)[] = [
  SymbolShape.X, null, null,
  null, SymbolShape.O, null,
  null, null, SymbolShape.X,
];

export function GameMark() {
  return (
    <div
      aria-hidden="true"
      className="glass-cell grid size-14 shrink-0 grid-cols-3 grid-rows-3 gap-1 rounded-xl p-1.5 shadow-lg"
    >
      {MARKS.map((mark, index) => (
        <span
          key={index}
          className={cn(
            "grid size-full min-h-0 min-w-0 place-items-center rounded-md transition-colors",
            mark === SymbolShape.X &&
              "bg-[rgb(var(--player-color)/0.15)] text-[rgb(var(--player-color))] shadow-[inset_0_0_0_1px_rgb(var(--player-color)/0.3)]",
            mark === SymbolShape.O &&
              "bg-foreground/10 text-foreground/70 shadow-[inset_0_0_0_1px_var(--border)]",
            !mark && "bg-transparent",
          )}
        >
          {mark && <SymbolShapeRenderer shape={mark} strokeWidth={12} className="h-3.5 w-3.5" />}
        </span>
      ))}
    </div>
  );
}
