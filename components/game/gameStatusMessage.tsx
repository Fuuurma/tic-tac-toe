import React from "react";
// Adjust import paths as needed
import { PlayerSymbol } from "@/app/game/constants/constants";
import { cn } from "@/lib/utils"; // Assuming you have a utility for clsx/tailwind-merge
import { CheckCircle, Info, Trophy } from "lucide-react"; // Add icons for visual flair

interface GameStatusMessageProps {
  message: string | null; // General status message (e.g., "Player X's turn")
  winner: PlayerSymbol | "draw" | null; // Indicates winner or draw state
  winningPlayerName?: string | null; // Optional: Name of the winning player
}

export const GameStatusMessage: React.FC<GameStatusMessageProps> = React.memo(
  ({ message, winner, winningPlayerName }) => {
    // Determine the message text and style based on winner or ongoing message
    let statusText: string | null = null;
    let statusVariant: "winner" | "draw" | "info" | null = null;
    let IconComponent: React.ElementType | null = null;

    if (winner) {
      if (winner === "draw") {
        statusText = "It's a draw!";
        statusVariant = "draw";
        IconComponent = CheckCircle; // Or another suitable icon
      } else {
        statusText = `${winningPlayerName || `Player ${winner}`} wins! 🎉`;
        statusVariant = "winner";
        IconComponent = Trophy; // Trophy icon for the winner
      }
    } else if (message) {
      statusText = message;
      statusVariant = "info";
      IconComponent = Info; // Info icon for general messages
    }

    // If no text to display, render nothing
    if (!statusText) {
      return null;
    }

    // Apply styling based on the variant
    const containerClasses = cn(
      "flex items-center justify-center gap-2 text-center p-3 rounded-md font-medium text-base w-full shadow-sm z-10",
      {
        // Conditional classes based on statusVariant
        "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-700":
          statusVariant === "winner",
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700":
          statusVariant === "draw", // Use yellow/orange for draw?
        "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700":
          statusVariant === "info",
      }
    );

    return (
      <div className={containerClasses} role="alert">
        {IconComponent && <IconComponent className="h-5 w-5 shrink-0" />}
        <span>{statusText}</span>
      </div>
    );
  }
);

GameStatusMessage.displayName = "GameStatusMessage";
