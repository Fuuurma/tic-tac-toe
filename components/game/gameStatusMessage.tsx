import React from "react";
import { PlayerSymbol } from "@/app/game/constants/constants";
import { cn } from "@/lib/utils";

interface GameStatusMessageProps {
  message: string | null;
  winner: PlayerSymbol | "draw" | null;
  winningPlayerName?: string | null;
}

export const GameStatusMessage: React.FC<GameStatusMessageProps> = React.memo(
  ({ message, winner, winningPlayerName }) => {
    let statusText: string | null = null;
    let statusVariant: "winner" | "draw" | null = null;

    if (winner) {
      if (winner === "draw") {
        statusText = "Draw - No Winner";
        statusVariant = "draw";
      } else {
        statusText = `${winningPlayerName || `Player ${winner}`} Wins!`;
        statusVariant = "winner";
      }
    } else if (message) {
      statusText = message;
    }

    if (!statusText) {
      return null;
    }

    const containerClasses = cn(
      "font-bold text-lg text-white drop-shadow-md",
      statusVariant === "draw" && "text-white/90"
    );

    return (
      <div className={containerClasses} role="alert">
        <span>{statusText}</span>
      </div>
    );
  }
);

GameStatusMessage.displayName = "GameStatusMessage";
