import React from "react";
import {
  Color,
  COLOR_VARIANTS,
  PlayerSymbol,
} from "@/app/game/constants/constants"; // Adjust import paths
import { clsx, type ClassValue } from "clsx"; // Using clsx for cleaner className logic
import { twMerge } from "tailwind-merge"; // Optional: For resolving Tailwind class conflicts

// Helper to merge classes, especially useful with conditional Tailwind classes
const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

interface BoardCellProps {
  index: number;
  value: PlayerSymbol | null; // 'X', 'O', or null
  // Pass the map of player symbols to their chosen Color enum value
  playerColors: { [key in PlayerSymbol]?: Color };
  isNextToRemove: boolean; // Is this cell marked for removal?
  removalSymbol?: PlayerSymbol | null; // Which player's mark is being removed? X or O?
  isDisabled: boolean; // Is interaction disabled? (occupied or game over)
  onClick: (index: number) => void;
}

// Define base styles using theme variables for better consistency
const BASE_CELL_STYLE =
  "relative aspect-square h-full w-full rounded-md border-2 flex items-center justify-center text-4xl md:text-5xl font-bold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const EMPTY_CELL_STYLE =
  "bg-card border-border hover:bg-muted/50 dark:hover:bg-muted/30"; // Theme-aware empty cell
const DEFAULT_FALLBACK_COLOR = Color.GRAY; // Fallback if color is missing

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
    // Get the corresponding style object from COLOR_VARIANTS, using a fallback
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
      value && colorScheme // Apply player-specific styles if cell has value
        ? `${colorScheme.bgLight} ${colorScheme.border} ${colorScheme.text}` // Use bgLight for contrast? Or bg? Test visually.
        : EMPTY_CELL_STYLE, // Styles for empty cell
      !isDisabled && !value ? "cursor-pointer" : "cursor-default", // Cursor only for clickable empty cells
      isNextToRemove ? "opacity-80" : "", // Slightly fade cell marked for removal? (Optional UX)
      // Add player-specific pulse animation if defined in COLOR_VARIANTS and globals.css
      isNextToRemove && removalColorScheme?.pulse
        ? removalColorScheme.pulse
        : isNextToRemove
        ? "animate-pulse"
        : "" // Use specific pulse or generic
    );

    // 4. Construct classes for the animated removal border
    const removalBorderClasses = cn(
      "absolute inset-[-2px] animate-wiggle border-4 rounded-lg z-10 pointer-events-none",
      removalColorScheme?.border // Use the border color class from the removal player's scheme
    );

    // 5. Click handler
    const handleCellClick = () => {
      // Only trigger click if the cell is empty and the game allows moves
      if (!value && !isDisabled) {
        onClick(index);
      }
    };

    return (
      <button
        type="button" // Explicitly set button type
        key={index} // Key is technically not needed here if used in map in parent
        className={cellClasses}
        onClick={handleCellClick}
        disabled={isDisabled || !!value} // Disable if game over OR cell already filled
        aria-label={`Cell ${index + 1}${
          value ? `, occupied by ${value}` : ", empty"
        }${isDisabled || !!value ? ", disabled" : ""}`}
      >
        {/* Display X or O */}
        {value}

        {/* Visual indicator for removal (animated border) */}
        {isNextToRemove && <div className={removalBorderClasses} />}
      </button>
    );
  }
);

BoardCell.displayName = "BoardCell";
