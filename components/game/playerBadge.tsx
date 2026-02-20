import React from "react";
import {
  Color,
  COLOR_VARIANTS,
  PlayerSymbol,
  PlayerTypes,
} from "@/app/game/constants/constants";
import { PlayerType } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface PlayerInfoBadgeProps {
  symbol: PlayerSymbol;
  username: string;
  type: PlayerType;
  color: Color;
  isCurrentPlayer: boolean;
}

const DEFAULT_FALLBACK_COLOR = Color.GRAY;

export const PlayerInfoBadge: React.FC<PlayerInfoBadgeProps> = React.memo(
  ({ symbol, username, type, color, isCurrentPlayer }) => {
    const colorScheme =
      COLOR_VARIANTS[color] || COLOR_VARIANTS[DEFAULT_FALLBACK_COLOR];

    return (
      <div
        className={cn(
          "flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm shadow-md border-2 transition-all duration-200",
          colorScheme.bgLight,
          isCurrentPlayer 
            ? `${colorScheme.border} ring-2 ring-offset-2 ${colorScheme.border}` 
            : colorScheme.border,
          isCurrentPlayer && "scale-105"
        )}
        title={`${username} (${type}) - ${symbol}`}
      >
        <span className={cn("font-bold text-lg sm:text-xl", colorScheme.text)}>
          {symbol}
        </span>

        <div className="flex flex-col">
          <span className="truncate max-w-[60px] sm:max-w-[80px] font-semibold text-foreground text-xs sm:text-sm leading-tight">
            {username || "Player"}
          </span>
          <span className="hidden xs:flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            {type === PlayerTypes.COMPUTER ? (
              <>
                <Bot className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">AI</span>
              </>
            ) : (
              <>
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span className="hidden sm:inline">You</span>
              </>
            )}
          </span>
        </div>

        {isCurrentPlayer && (
          <span
            className="ml-auto w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse shrink-0 shadow-sm"
            title="Current Turn"
          />
        )}
      </div>
    );
  }
);

PlayerInfoBadge.displayName = "PlayerInfoBadge";
