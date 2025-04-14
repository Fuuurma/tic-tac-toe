import React from "react";
import {
  Color,
  COLOR_VARIANTS,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

interface BoardCellProps {
  index: number;
  value: PlayerSymbol | null;
  playerColors: { [key in PlayerSymbol]?: Color };
  isNextToRemove: boolean;
  removalSymbol?: PlayerSymbol | null;
  isDisabled: boolean;
  onClick: (index: number) => void;
}

const BASE_CELL_STYLE =
  "relative aspect-square h-full w-full rounded-md border-2 flex items-center justify-center text-4xl md:text-5xl font-bold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const EMPTY_CELL_STYLE =
  "bg-card border-border hover:bg-muted/50 dark:hover:bg-muted/30";
const DEFAULT_FALLBACK_COLOR = Color.GRAY;

export const BoardCell: React.FC<BoardCellProps> = React.memo(
  ({
    index,
    value,
    playerColors,
    isNextToRemove,
    removalSymbol,
    isDisabled,
    onClick,
  }) => {
    // 1. Determine the color scheme for the cell based on its value (X or O)
    const playerColorEnum = value ? playerColors[value] : undefined;

    const colorScheme =
      COLOR_VARIANTS[playerColorEnum || DEFAULT_FALLBACK_COLOR];

    // 2. Determine the color scheme for the removal indicator border
    const removalColorEnum = removalSymbol
      ? playerColors[removalSymbol]
      : undefined;
    const removalColorScheme =
      COLOR_VARIANTS[removalColorEnum || DEFAULT_FALLBACK_COLOR];

    // 3. Construct cell classes using cn (clsx + tailwind-merge)
    const cellClasses = cn(
      BASE_CELL_STYLE,
      value && colorScheme
        ? `${colorScheme.bgLight} ${colorScheme.border} ${colorScheme.text}`
        : EMPTY_CELL_STYLE,
      !isDisabled && !value ? "cursor-pointer" : "cursor-default",
      isNextToRemove ? "opacity-80" : "",

      isNextToRemove && removalColorScheme?.pulse
        ? removalColorScheme.pulse
        : isNextToRemove
        ? "animate-pulse"
        : ""
    );

    // 4. Construct classes for the animated removal border
    const removalBorderClasses = cn(
      "absolute inset-[-2px] animate-wiggle border-4 rounded-lg z-10 pointer-events-none",
      removalColorScheme?.border
    );

    // 5. Click handler
    const handleCellClick = () => {
      if (!value && !isDisabled) {
        onClick(index);
      }
    };

    return (
      <button
        type="button"
        key={index}
        className={cellClasses}
        onClick={handleCellClick}
        disabled={isDisabled || !!value}
        aria-label={`Cell ${index + 1}${
          value ? `, occupied by ${value}` : ", empty"
        }${isDisabled || !!value ? ", disabled" : ""}`}
      >
        {/* Display X or O */}
        {value}

        {isNextToRemove && <div className={removalBorderClasses} />}
      </button>
    );
  }
);

BoardCell.displayName = "BoardCell";
