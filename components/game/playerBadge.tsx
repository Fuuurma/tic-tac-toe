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
          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow-md border-2 transition-all duration-200",
          colorScheme.bgLight,
          isCurrentPlayer 
            ? `${colorScheme.border} ring-2 ring-offset-2 ${colorScheme.border}` 
            : colorScheme.border,
          isCurrentPlayer && "scale-105"
        )}
        title={`${username} (${type}) - ${symbol}`}
      >
        <span className={cn("font-bold text-xl", colorScheme.text)}>
          {symbol}
        </span>

        <div className="flex flex-col">
          <span className="truncate max-w-[80px] md:max-w-[100px] font-semibold text-foreground text-sm leading-tight">
            {username || "Player"}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {type === PlayerTypes.COMPUTER ? (
              <>
                <Bot className="h-3 w-3" />
                AI
              </>
            ) : (
              <>
                <User className="h-3 w-3" />
                You
              </>
            )}
          </span>
        </div>

        {isCurrentPlayer && (
          <span
            className="ml-auto w-3 h-3 bg-green-500 rounded-full animate-pulse shrink-0 shadow-sm"
            title="Current Turn"
          />
        )}
      </div>
    );
  }
);

PlayerInfoBadge.displayName = "PlayerInfoBadge";
