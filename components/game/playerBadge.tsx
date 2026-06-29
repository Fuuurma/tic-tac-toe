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
          "flex min-w-0 items-center gap-1 rounded-lg border-2 px-2 py-1.5 text-xs shadow-sm transition-all duration-200 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm",
          colorScheme.bgLight,
          isCurrentPlayer 
            ? `${colorScheme.border} ring-2 ring-primary/35 ring-offset-1 ring-offset-background` 
            : colorScheme.border,
          isCurrentPlayer && "scale-[1.02]"
        )}
        title={`${username} (${type}) - ${symbol}`}
      >
        <span className={cn("font-bold text-lg sm:text-xl", colorScheme.text)}>
          {symbol}
        </span>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold leading-tight text-foreground text-xs sm:text-sm">
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
                <span className="hidden sm:inline">Human</span>
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
