import { Color, PlayerSymbol } from "@/game/constants";
import { COLOR_RING_CLASSES } from "@/game/constants";
import { cn } from "@/lib/utils";

interface BoardCellProps {
  index: number;
  value: PlayerSymbol | null;
  valueColor?: Color;
  isNextToRemove: boolean;
  isWinningCell: boolean;
  isDisabled: boolean;
  isHovered: boolean;
  previewPlayer?: PlayerSymbol;
  previewColor?: Color;
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

export function BoardCell({
  index,
  value,
  valueColor,
  isNextToRemove,
  isWinningCell,
  isDisabled,
  isHovered,
  previewPlayer,
  previewColor,
  onClick,
  onHover,
}: BoardCellProps) {
  const showPreview = !value && !isDisabled && isHovered && previewPlayer;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={buildAriaLabel(index, value, isNextToRemove)}
      aria-disabled={!value && isDisabled}
      onClick={() => onClick(index)}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(index)}
      onBlur={() => onHover?.(null)}
      className={cn(
        "relative flex aspect-square items-center justify-center rounded-lg border-2 bg-background/50 text-5xl font-black sm:text-6xl md:text-7xl transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isDisabled && !value && "cursor-not-allowed opacity-60",
        isWinningCell && "bg-emerald-500/15 border-emerald-500/50",
        !isWinningCell && value && "border-foreground/20",
        !isWinningCell && !value && "hover:border-foreground/30",
        isNextToRemove && !isWinningCell && valueColor && COLOR_RING_CLASSES[valueColor],
      )}
    >
      {value && (
        <span
          aria-hidden="true"
          className={cn(
            "transition-all duration-300 ease-out scale-100 opacity-100 animate-pop-in",
            isNextToRemove && "animate-shimmer",
            SYMBOL_COLOR[valueColor ?? Color.GRAY],
          )}
        >
          {value}
        </span>
      )}

      {showPreview && previewPlayer && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 flex items-center justify-center text-5xl font-black sm:text-6xl md:text-7xl opacity-30 scale-90 transition-all duration-200",
            previewColor && SYMBOL_COLOR[previewColor],
          )}
        >
          {previewPlayer}
        </span>
      )}

      {isNextToRemove && !isWinningCell && value && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1 rounded-md border-2 border-dashed border-current opacity-40 animate-wiggle"
        />
      )}
    </button>
  );
}

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
