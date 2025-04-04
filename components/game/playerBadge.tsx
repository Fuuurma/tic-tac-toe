import React from "react";
// Adjust import paths based on your project structure
import {
  Color,
  COLOR_VARIANTS,
  PlayerSymbol,
} from "@/app/game/constants/constants";
import { PlayerType } from "@/app/types/types"; // Assuming PlayerType is defined here
import { cn } from "@/lib/utils"; // Assuming you have a utility for clsx/tailwind-merge

interface PlayerInfoBadgeProps {
  symbol: PlayerSymbol;
  username: string;
  type: PlayerType;
  color: Color; // Player's chosen color enum
  isCurrentPlayer: boolean;
}

const DEFAULT_FALLBACK_COLOR = Color.GRAY;

export const PlayerInfoBadge: React.FC<PlayerInfoBadgeProps> = React.memo(
  ({ symbol, username, type, color, isCurrentPlayer }) => {
    // Get the color scheme based on the player's color, with a fallback
    const colorScheme =
      COLOR_VARIANTS[color] || COLOR_VARIANTS[DEFAULT_FALLBACK_COLOR];

    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full text-sm shadow-sm border",
          // Apply background, border, and subtle text color from the scheme
          `${colorScheme.bgLight} ${colorScheme.border}`, // Use light bg and standard border
          // Ensure enough contrast for text within the badge if needed, or use default text color
          "text-foreground/80" // Or use colorScheme.text if contrast is good on bgLight
        )}
        title={`${username} (${type}) - ${symbol}`}
      >
        {/* Player Symbol (X or O) with its specific text color */}
        <span className={cn("font-bold text-lg", colorScheme.text)}>
          {symbol}
        </span>

        {/* Player Username - truncate if too long */}
        <span className="truncate max-w-[80px] md:max-w-[100px] font-medium">
          {username || "Player"} {/* Fallback username */}
        </span>

        {/* Player Type (Human/AI) - less prominent */}
        <span className="text-xs text-muted-foreground hidden md:inline">
          {" "}
          {/* Hide on small screens */}({type})
        </span>

        {/* Current Turn Indicator */}
        {isCurrentPlayer && (
          <span
            className="ml-auto w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shrink-0"
            title="Current Turn"
            aria-label="Current Turn Indicator"
          />
        )}
      </div>
    );
  }
);

PlayerInfoBadge.displayName = "PlayerInfoBadge";
