import React from "react";
import { PlayerSymbol } from "@/app/game/constants/constants";

interface GameStatusMessageProps {
  message: string | null;
  winner: PlayerSymbol | null;
  winningPlayerName?: string | null;
  moveCount?: number;
}

export const GameStatusMessage: React.FC<GameStatusMessageProps> = React.memo(
  ({ message, winner, winningPlayerName, moveCount }) => {
    let statusText: string | null = null;
    let subtitleText: string | null = null;

    if (winner) {
      statusText = `${winningPlayerName || `Player ${winner}`} Wins!`;
      if (moveCount !== undefined && moveCount > 0) {
        subtitleText = `Won in ${moveCount} move${moveCount === 1 ? "" : "s"}`;
      }
    } else if (message) {
      statusText = message;
    }

    if (!statusText) {
      return null;
    }

    const containerClasses = "font-bold text-lg text-white drop-shadow-md flex flex-col items-start";

    return (
      <div className={containerClasses} role="alert">
        <span>{statusText}</span>
        {subtitleText && (
          <span className="text-xs sm:text-sm font-normal text-white/80 mt-0.5">
            {subtitleText}
          </span>
        )}
      </div>
    );
  }
);

GameStatusMessage.displayName = "GameStatusMessage";
