import { memo, useEffect, useState } from "react";
import { Color, PlayerSymbol, SymbolShape } from "@/game/constants";
import { getShapeLabel, t, useStrings } from "@/i18n/language";
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
  /** Plain-language reason the cell cannot be played, appended to the
   *  accessible name. Absent when the cell is playable. */
  disabledReason?: string;
  isHovered: boolean;
  previewPlayer?: PlayerSymbol;
  previewColor?: Color;
  previewShape?: SymbolShape;
  /** The cell a guide wants the player to notice. Teaching surfaces only. */
  isHint?: boolean;
  /** Let a retired mark fade out instead of vanishing in one frame. */
  showVanish?: boolean;
  onClick: (index: number) => void;
  onHover?: (index: number | null) => void;
}

/** Matches the `vanish` keyframe; the ghost is removed once it has played. */
const VANISH_MS = 600;

// Marks step one shade darker off-dark: -500s tuned for the black well
// wash out on white (yellow especially), while dark keeps its exact hues.
const SYMBOL_COLOR: Record<Color, string> = {
  [Color.BLUE]: "text-blue-600 dark:text-blue-500",
  [Color.GREEN]: "text-green-600 dark:text-green-500",
  [Color.YELLOW]: "text-yellow-600 dark:text-yellow-500",
  [Color.ORANGE]: "text-orange-600 dark:text-orange-500",
  [Color.RED]: "text-red-600 dark:text-red-500",
  [Color.PINK]: "text-pink-600 dark:text-pink-500",
  [Color.PURPLE]: "text-purple-600 dark:text-purple-500",
  [Color.GRAY]: "text-gray-600 dark:text-gray-500",
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

export const BoardCell = memo(function BoardCell(props: BoardCellProps) {
  // Subscribes so a language switch rebuilds the aria label even though no
  // prop changed (the memo would otherwise hold the old language).
  useStrings();
  const ghost = useVanishGhost(props.showVanish ?? false, props.value, props.valueShape, props.valueColor);
  const { index, value, valueShape, isNextToRemove, isDisabled, disabledReason, isHint, onClick, onHover } = props;

  return (
    <button
      type="button"
      aria-label={buildAriaLabel(index, value, valueShape, isNextToRemove, disabledReason, isHint)}
      aria-keyshortcuts={String(index + 1)}
      aria-disabled={isDisabled || value !== null}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled || value !== null) return;
        onClick(index);
      }}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(index)}
      onBlur={() => onHover?.(null)}
      className={getBoardCellClassName(props)}
    >
      {renderBoardCellContents(props, ghost)}
    </button>
  );
});

/**
 * The mark that was just here, kept alive long enough to fade. The engine
 * clears a retired cell in the same commit that places the new mark, so
 * without this the vanish is one frame, easy to miss on the very rule the
 * game is named for.
 */
interface VanishGhost {
  shape: SymbolShape;
  color: Color;
}

function useVanishGhost(
  enabled: boolean,
  value: PlayerSymbol | null,
  shape: SymbolShape | undefined,
  color: Color | undefined,
): VanishGhost | null {
  const [last, setLast] = useState({ value, shape, color });
  const [ghost, setGhost] = useState<VanishGhost | null>(null);

  // Derived from props during render (the pattern Sheet uses for `open`), not
  // from an effect, so the ghost exists in the same commit the mark leaves.
  if (last.value !== value) {
    setLast({ value, shape, color });
    if (value) setGhost(null);
    else if (enabled && last.shape && last.color) setGhost({ shape: last.shape, color: last.color });
  }

  useEffect(() => {
    if (!ghost) return;
    const id = window.setTimeout(() => setGhost(null), VANISH_MS);
    return () => window.clearTimeout(id);
  }, [ghost]);

  return ghost;
}

function renderBoardCellContents(props: BoardCellProps, ghost: VanishGhost | null) {
  const {
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
  } = props;
  const showPreview = !value && !isDisabled && isHovered && previewPlayer;

  return (
    <>
      {ghost && (
        <span
          aria-hidden="true"
          data-vanishing="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center animate-vanish"
        >
          <SymbolShapeRenderer
            shape={ghost.shape}
            strokeWidth={7}
            className={cn("h-3/5 w-3/5", SYMBOL_COLOR[ghost.color])}
          />
        </span>
      )}
      {value && valueShape && (
        <SymbolShapeRenderer
          shape={valueShape}
          strokeWidth={7}
          className={cn(
            "h-3/5 w-3/5 transition-all duration-300 ease-out animate-pop-in",
            isNextToRemove && !isWinningCell && "animate-sos-blink",
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
    </>
  );
}

function getBoardCellClassName({
  value,
  valueColor,
  isNextToRemove,
  isWinningCell,
  isDisabled,
  isHint,
}: BoardCellProps): string {
  return cn(
    "relative flex aspect-square items-center justify-center rounded-xl transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    !isWinningCell && !isNextToRemove && !value && "glass-cell",
    !isDisabled && !value && "cursor-pointer",
    !isDisabled && !value && "hover:border-[rgb(var(--player-color)/0.5)] hover:bg-[rgb(var(--player-color)/0.1)]",
    !isDisabled && value && "hover:shadow-sm",
    isDisabled && !value && "cursor-not-allowed opacity-50",
    isHint && !value && !isDisabled && "animate-pulse-slow border-[rgb(var(--player-color)/0.7)] bg-[rgb(var(--player-color)/0.14)] ring-2 ring-[rgb(var(--player-color)/0.45)]",
    isWinningCell && "bg-emerald-500/20 border-2 border-emerald-500/70 shadow-lg shadow-emerald-500/30 animate-win-glow",
    !isWinningCell && isNextToRemove && value && "border-2 animate-wiggle",
    !isWinningCell && isNextToRemove && value && valueColor && NEXT_TO_REMOVE_CLASSES[valueColor],
    !isWinningCell && !isNextToRemove && value && valueColor && OCCUPIED_TINT_CLASSES[valueColor],
  );
}

const buildAriaLabel = (
  index: number,
  value: PlayerSymbol | null,
  valueShape: SymbolShape | undefined,
  isNextToRemove: boolean,
  disabledReason?: string,
  isHint?: boolean,
): string => {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  if (value) {
    const mark = valueShape ? getShapeLabel(valueShape) : value;
    return isNextToRemove
      ? t("board.occupiedCellRemoving", { row, col, mark })
      : t("board.occupiedCell", { row, col, mark });
  }
  // An unplayable cell used to announce as plain "empty", which tells a
  // screen-reader user nothing about why it cannot be played — the board
  // looked interactive and behaved like a dead end. Say it outright.
  if (disabledReason && isHint) return t("board.emptyCellReasonHint", { row, col, reason: disabledReason });
  if (disabledReason) return t("board.emptyCellReason", { row, col, reason: disabledReason });
  if (isHint) return t("board.emptyCellHint", { row, col });
  return t("board.emptyCell", { row, col });
};
