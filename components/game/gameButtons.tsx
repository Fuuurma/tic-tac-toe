import { isOnlineGame } from "@/app/utils/gameModeChecks";
import { Button } from "../ui/button";

interface GameButtonsProps {
  isOnlineGame: boolean;
  isLocalGame: boolean;
  isGameOver: boolean;
  rematchOffered: boolean;
  rematchRequested: boolean;
  onAcceptRematch: () => void;
  onDeclineRematch: () => void;
  onLeaveRoom: () => void;
  onRequestRematch: () => void;
  resetGame: () => void;
  exitGame: () => void;
}

const GameButtons: React.FC<GameButtonsProps> = ({
  isOnlineGame = false,
  isLocalGame = false,
  isGameOver = false,
  rematchOffered = false,
  rematchRequested = false,
  onAcceptRematch,
  onDeclineRematch,
  onRequestRematch,
  onLeaveRoom,
  resetGame,
  exitGame,
}) => {
  // Online game buttons with rematch functionality
  if (isOnlineGame) {
    if (isGameOver) {
      // Game is over - show appropriate rematch options
      if (rematchOffered) {
        return (
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              onClick={onAcceptRematch}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Accept Rematch
            </Button>
            <Button
              onClick={onDeclineRematch}
              variant="outline"
              className="flex-1"
            >
              Decline
            </Button>
            <Button
              onClick={onLeaveRoom}
              variant="destructive"
              className="flex-1"
            >
              Leave Room
            </Button>
          </div>
        );
      } else if (rematchRequested) {
        return (
          <div className="flex gap-2 w-full items-center">
            <span className="text-sm text-muted-foreground flex-1 text-center">
              Waiting for opponent...
            </span>
            <Button onClick={onLeaveRoom} variant="destructive">
              Leave Room
            </Button>
          </div>
        );
      } else {
        return (
          <div className="flex gap-2 w-full">
            <Button onClick={onRequestRematch} className="flex-1">
              Request Rematch
            </Button>
            <Button
              onClick={onLeaveRoom}
              variant="destructive"
              className="flex-1"
            >
              Leave Room
            </Button>
          </div>
        );
      }
    } else {
      // Online game is active
      return (
        <div className="flex gap-2 w-full">
          <Button variant="outline" disabled className="flex-1">
            Reset
          </Button>
          <Button
            onClick={onLeaveRoom}
            variant="destructive"
            className="flex-1"
          >
            Exit Game
          </Button>
        </div>
      );
    }
  }

  // Local game buttons (VS AI or VS Friend)
  else if (isLocalGame) {
    return (
      <div className="flex gap-2 w-full">
        <Button onClick={resetGame} variant="outline" className="flex-1">
          Reset Game
        </Button>
        <Button onClick={exitGame} variant="destructive" className="flex-1">
          Exit Game
        </Button>
      </div>
    );
  }

  // Fallback buttons
  return (
    <div className="flex gap-2 w-full">
      <Button onClick={resetGame} variant="outline" className="flex-1">
        Reset Game
      </Button>
      <Button onClick={exitGame} variant="destructive" className="flex-1">
        Exit Game
      </Button>
    </div>
  );
};

export default GameButtons;
