import { COLOR_RGB, Color, SymbolShape } from "@/game/constants";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "../game/symbolShapeRenderer";

interface MarkTile {
  shape: SymbolShape;
  color: "player" | "opponent";
}

const MARKS: (MarkTile | null)[] = [
  { shape: SymbolShape.X, color: "player" }, null, null,
  null, { shape: SymbolShape.O, color: "opponent" }, null,
  null, null, { shape: SymbolShape.X, color: "player" },
];

interface GameMarkProps {
  playerColor: Color;
  opponentColor: Color;
}

export function GameMark({ playerColor, opponentColor }: GameMarkProps) {
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
            mark &&
              "bg-[rgb(var(--mark-color)/0.15)] text-[rgb(var(--mark-color))] shadow-[inset_0_0_0_1px_rgb(var(--mark-color)/0.3)]",
            !mark && "bg-transparent",
          )}
          style={
            mark
              ? ({
                  "--mark-color":
                    COLOR_RGB[mark.color === "player" ? playerColor : opponentColor],
                } as React.CSSProperties)
              : undefined
          }
        >
          {mark && <SymbolShapeRenderer shape={mark.shape} strokeWidth={12} className="h-2.5 w-2.5" />}
        </span>
      ))}
    </div>
  );
}
