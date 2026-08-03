import { memo } from "react";
import { Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { cn } from "@/lib/utils";
import { SymbolShapeRenderer } from "./symbolShapeRenderer";

interface BoardCellProps {
  index: number;
  value: PlayerSymbol | null;
  valueColor?: Color;
  valueShape?: SymbolShape;
  isNextToRemove: boolean;
  isWinningCell: boolean;
  isDisabled: boolean;
  isHovered: boolean;
  previewPlayer?: PlayerSymbol;
  previewColor?: Color;
  previewShape?: SymbolShape;
  onClick: (index: number) => void;
  onHover?: (index: number | null) => void;
}

const SYMBOL_COLOR: Record<Color, string> = {
  [Color.BLUE]: "text-blue-500",
  [Color.GREEN]: "text-green-500",
  [Color.YELLOW]: "text-yellow-500",
  [Color.ORANGE]: "text-orange-500",
  [Color.RED]: "text-red-500",
  [Color.PINK]: "text-pink-500",
  [Color.PURPLE]: "text-purple-500",
  [Color.GRAY]: "text-gray-500",
};

const NEXT_TO_REMOVE_CLASSES: Record<Color, string> = {
  [Color.BLUE]: "border-blue-500/70 bg-blue-500/10 shadow-lg shadow-blue-500/30",
  [Color.GREEN]: "border-green-500/70 bg-green-500/10 shadow-lg shadow-green-500/30",
  [Color.YELLOW]: "border-yellow-500/70 bg-yellow-500/10 shadow-lg shadow-yellow-500/30",
  [Color.ORANGE]: "border-orange-500/70 bg-orange-500/10 shadow-lg shadow-orange-500/30",
  [Color.RED]: "border-red-500/70 bg-red-500/10 shadow-lg shadow-red-500/30",
  [Color.PINK]: "border-pink-500/70 bg-pink-500/10 shadow-lg shadow-pink-500/30",
  [Color.PURPLE]: "border-purple-500/70 bg-purple-500/10 shadow-lg shadow-purple-500/30",
  [Color.GRAY]: "border-gray-500/70 bg-gray-500/10 shadow-lg shadow-gray-500/30",
};

const OCCUPIED_TINT_CLASSES: Record<Color, string> = {
  [Color.BLUE]: "bg-blue-500/10 shadow-md shadow-blue-500/20",
  [Color.GREEN]: "bg-green-500/10 shadow-md shadow-green-500/20",
  [Color.YELLOW]: "bg-yellow-500/10 shadow-md shadow-yellow-500/20",
  [Color.ORANGE]: "bg-orange-500/10 shadow-md shadow-orange-500/20",
  [Color.RED]: "bg-red-500/10 shadow-md shadow-red-500/20",
  [Color.PINK]: "bg-pink-500/10 shadow-md shadow-pink-500/20",
  [Color.PURPLE]: "bg-purple-500/10 shadow-md shadow-purple-500/20",
  [Color.GRAY]: "bg-gray-500/10 shadow-md shadow-gray-500/20",
};

export const BoardCell = memo(function BoardCell({
  index,
  value,
  valueColor,
  valueShape,
  isNextToRemove,
  isWinningCell,
  isDisabled,
  isHovered,
  previewPlayer,
  previewColor,
  previewShape,
  onClick,
  onHover,
}: BoardCellProps) {
  const showPreview = !value && !isDisabled && isHovered && previewPlayer;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={buildAriaLabel(index, value, isNextToRemove)}
      aria-keyshortcuts={String(index + 1)}
      aria-disabled={isDisabled || value !== null}
      disabled={isDisabled || value !== null}
      onClick={() => onClick(index)}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(index)}
      onBlur={() => onHover?.(null)}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-xl transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        !isWinningCell && !isNextToRemove && !value && "glass-cell",
        !isDisabled && !value && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98]",
        !isDisabled && !value && "hover:border-[rgb(var(--player-color)/0.5)] hover:bg-[rgb(var(--player-color)/0.1)]",
        !isDisabled && value && "hover:shadow-sm",
        isDisabled && !value && "cursor-not-allowed opacity-50",
        isWinningCell && "bg-emerald-500/20 border-2 border-emerald-500/70 shadow-lg shadow-emerald-500/30",
        !isWinningCell && isNextToRemove && value && "border-2 animate-wiggle",
        !isWinningCell && isNextToRemove && value && valueColor && NEXT_TO_REMOVE_CLASSES[valueColor],
        !isWinningCell && !isNextToRemove && value && valueColor && OCCUPIED_TINT_CLASSES[valueColor],
      )}
    >
      {value && valueShape && (
        <SymbolShapeRenderer
          shape={valueShape}
          strokeWidth={7}
          className={cn(
            "h-3/5 w-3/5 transition-all duration-300 ease-out animate-pop-in",
            isNextToRemove && !isWinningCell && "animate-blink-fade",
            SYMBOL_COLOR[valueColor ?? Color.GRAY],
          )}
        />
      )}

      {showPreview && previewPlayer && previewShape && (
        <SymbolShapeRenderer
          shape={previewShape}
          strokeWidth={7}
          className={cn(
            "absolute h-3/5 w-3/5 opacity-30 scale-90 transition-all duration-200",
            previewColor && SYMBOL_COLOR[previewColor],
          )}
        />
      )}
    </button>
  );
});

const buildAriaLabel = (
  index: number,
  value: PlayerSymbol | null,
  isNextToRemove: boolean,
): string => {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  const position = `Row ${row} column ${col}`;
  if (value) {
    return `${position}, occupied by ${value}${isNextToRemove ? ", next to be removed" : ""}`;
  }
  return `${position}, empty`;
};
