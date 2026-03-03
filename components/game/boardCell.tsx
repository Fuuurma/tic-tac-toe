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
  "relative aspect-square w-full rounded-2xl lg:rounded-3xl border-3 sm:border-4 md:border-5 flex items-center justify-center text-7xl sm:text-8xl md:text-9xl lg:text-[7rem] xl:text-[9rem] font-extrabold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const EMPTY_CELL_STYLE =
  "bg-card/30 border-border/50 hover:bg-accent/40 hover:border-accent-foreground/40 cursor-pointer backdrop-blur-sm";
const DEFAULT_FALLBACK_COLOR = Color.GRAY;

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
      isWinningCell && "animate-winning-cell ring-4 ring-amber-400 ring-offset-2 ring-offset-background scale-105 z-10",
      isNextToRemove ? "opacity-80" : "",
      isNextToRemove && removalColorScheme?.pulse
        ? removalColorScheme.pulse
        : isNextToRemove
        ? "animate-pulse-slow"
        : "",
      isNewMove && "animate-place-piece",
      !value && !isDisabled && "hover:scale-[1.02] hover:shadow-xl"
    );

    const removalBorderClasses = cn(
      "absolute inset-0 animate-wiggle border-4 rounded-xl z-10 pointer-events-none",
      removalColorScheme?.border
    );

    const removalIndicatorClasses = cn(
      "absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-bold flex items-center justify-center animate-bounce",
      removalColorScheme?.bg,
      removalColorScheme?.text
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
        }${isDisabled || !!value ? ", disabled" : ""}`}
        aria-disabled={isDisabled || !!value}
        tabIndex={isDisabled && !!value ? -1 : 0}
      >
        <span
          className={cn(
            "transition-all duration-300 ease-out",
            value ? "scale-100 opacity-100 animate-pop-in" : "scale-0 opacity-0",
            isWinningCell && "animate-win-glow"
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

        {isNextToRemove && (
          <div className={removalIndicatorClasses} aria-label="Will be removed soon">
            1
          </div>
        )}
      </button>
    );
  }
);

BoardCell.displayName = "BoardCell";