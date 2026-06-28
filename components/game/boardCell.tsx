import React, { useState } from "react";
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
  currentPlayer?: PlayerSymbol;
  isNextToRemove: boolean;
  removalSymbol?: PlayerSymbol | null;
  isDisabled: boolean;
  isWinningCell?: boolean;
  onClick: (index: number) => void;
  isNewMove?: boolean;
}

const BASE_CELL_STYLE =
  "relative aspect-square w-full rounded-lg md:rounded-2xl lg:rounded-3xl border-2 sm:border-3 md:border-4 lg:border-5 flex items-center justify-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extrabold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const EMPTY_CELL_STYLE =
  "bg-card/30 border-border/50 hover:bg-accent/40 hover:border-accent-foreground/40 cursor-pointer backdrop-blur-sm";
const DEFAULT_FALLBACK_COLOR = Color.GRAY;
const NEXT_REMOVAL_LABEL = "Next out";

export const BoardCell: React.FC<BoardCellProps> = React.memo(
  ({
    index,
    value,
    playerColors,
    currentPlayer,
    isNextToRemove,
    removalSymbol,
    isDisabled,
    isWinningCell,
    onClick,
    isNewMove,
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    const playerColorEnum = value ? playerColors[value] : undefined;
    const colorScheme =
      COLOR_VARIANTS[playerColorEnum || DEFAULT_FALLBACK_COLOR];

    const removalColorEnum = removalSymbol
      ? playerColors[removalSymbol]
      : undefined;
    const removalColorScheme =
      COLOR_VARIANTS[removalColorEnum || DEFAULT_FALLBACK_COLOR];

    const hoverColorEnum = currentPlayer ? playerColors[currentPlayer] : undefined;
    const hoverColorScheme =
      COLOR_VARIANTS[hoverColorEnum || DEFAULT_FALLBACK_COLOR];

    const cellClasses = cn(
      BASE_CELL_STYLE,
      value && colorScheme
        ? `${colorScheme.bg} ${colorScheme.border} ${colorScheme.text} shadow-lg`
        : EMPTY_CELL_STYLE,
      isWinningCell && "animate-winning-cell ring-1 ring-amber-300/55 ring-offset-1 ring-offset-background z-10",
      isNextToRemove ? "opacity-95" : "",
      isNextToRemove && removalColorScheme?.pulse
        ? removalColorScheme.pulse
        : isNextToRemove
        ? "animate-pulse-slow"
        : "",
      isNewMove && "animate-place-piece",
      !value && !isDisabled && "hover:scale-[1.02] hover:shadow-xl"
    );

    const removalBorderClasses = cn(
      "absolute inset-0 animate-wiggle border rounded-lg md:rounded-2xl lg:rounded-3xl z-10 pointer-events-none opacity-70",
      removalColorScheme?.border
    );

    const handleCellClick = () => {
      if (!value && !isDisabled) {
        onClick(index);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCellClick();
      }
    };

    const handleMouseEnter = () => {
      if (!value && !isDisabled) {
        setIsHovered(true);
      }
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    return (
      <button
        type="button"
        role="gridcell"
        key={index}
        className={cellClasses}
        onClick={handleCellClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={isDisabled || !!value}
        aria-label={`Cell ${index + 1}${
          value ? `, occupied by ${value}` : ", empty"
        }${isNextToRemove && removalSymbol ? `, ${removalSymbol} piece next to be removed` : ""}${isDisabled || !!value ? ", disabled" : ""}`}
        aria-disabled={isDisabled || !!value}
        tabIndex={isDisabled && !!value ? -1 : 0}
      >
        {isNextToRemove && (
          <span className="absolute right-1 top-1 z-20 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-background/90 px-1 text-[8px] font-bold uppercase leading-none text-muted-foreground shadow-sm ring-1 ring-border sm:h-5 sm:min-w-0 sm:px-1.5 sm:text-[9px]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current sm:hidden" />
            <span className="sr-only sm:not-sr-only">{NEXT_REMOVAL_LABEL}</span>
          </span>
        )}

        <span
          className={cn(
            "transition-all duration-300 ease-out",
            value ? "scale-100 opacity-100 animate-pop-in" : "scale-0 opacity-0"
          )}
        >
          {value}
        </span>

        {!value && !isDisabled && isHovered && currentPlayer && (
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center text-7xl sm:text-8xl md:text-9xl lg:text-[7rem] xl:text-[9rem] font-extrabold transition-all duration-200",
              "opacity-30 scale-90",
              hoverColorScheme?.text
            )}
            aria-hidden="true"
          >
            {currentPlayer}
          </span>
        )}

        {isNextToRemove && <div className={removalBorderClasses} />}
      </button>
    );
  }
);

BoardCell.displayName = "BoardCell";
