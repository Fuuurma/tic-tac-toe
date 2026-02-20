import React from "react";
import { PlayerSymbol } from "@/app/game/constants/constants";
import { cn } from "@/lib/utils";
import { Trophy, HandMetal } from "lucide-react";

interface GameStatusMessageProps {
  message: string | null;
  winner: PlayerSymbol | "draw" | null;
  winningPlayerName?: string | null;
}

export const GameStatusMessage: React.FC<GameStatusMessageProps> = React.memo(
  ({ message, winner, winningPlayerName }) => {
    let statusText: string | null = null;
    let statusVariant: "winner" | "draw" | null = null;
    let IconComponent: React.ElementType | null = null;

    if (winner) {
      if (winner === "draw") {
        statusText = "Draw - No Winner";
        statusVariant = "draw";
        IconComponent = HandMetal;
      } else {
        statusText = `${winningPlayerName || `Player ${winner}`} Wins!`;
        statusVariant = "winner";
        IconComponent = Trophy;
      }
    } else if (message) {
      statusText = message;
    }

    if (!statusText) {
      return null;
    }

    const containerClasses = cn(
      "flex items-center justify-center gap-2 text-center font-bold text-lg w-full",
      (statusVariant === "winner" || statusVariant === "draw") && "text-white"
    );

    return (
      <div className={containerClasses} role="alert">
        {IconComponent && <IconComponent className="h-6 w-6 shrink-0" />}
        <span>{statusText}</span>
      </div>
    );
  }
);

GameStatusMessage.displayName = "GameStatusMessage";
