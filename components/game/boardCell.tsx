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
  "relative aspect-square h-full w-full rounded-lg border-2 flex items-center justify-center text-5xl md:text-6xl font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const EMPTY_CELL_STYLE =
  "bg-card/50 border-border hover:bg-accent/30 hover:border-accent-foreground/30 cursor-pointer";
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
    const playerColorEnum = value ? playerColors[value] : undefined;
    const colorScheme =
      COLOR_VARIANTS[playerColorEnum || DEFAULT_FALLBACK_COLOR];

    const removalColorEnum = removalSymbol
      ? playerColors[removalSymbol]
      : undefined;
    const removalColorScheme =
      COLOR_VARIANTS[removalColorEnum || DEFAULT_FALLBACK_COLOR];

    const cellClasses = cn(
      BASE_CELL_STYLE,
      value && colorScheme
        ? `${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`
        : EMPTY_CELL_STYLE,
      isNextToRemove ? "opacity-75" : "",
      isNextToRemove && removalColorScheme?.pulse
        ? removalColorScheme.pulse
        : isNextToRemove
        ? "animate-pulse"
        : ""
    );

    const removalBorderClasses = cn(
      "absolute inset-0 animate-wiggle border-4 rounded-lg z-10 pointer-events-none",
      removalColorScheme?.border
    );

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
        <span className={cn(
          "transition-all duration-200",
          value ? "scale-100 opacity-100" : "scale-0 opacity-0",
          !isDisabled && !value && "hover:scale-110"
        )}>
          {value}
        </span>

        {isNextToRemove && <div className={removalBorderClasses} />}
      </button>
    );
  }
);

BoardCell.displayName = "BoardCell";
