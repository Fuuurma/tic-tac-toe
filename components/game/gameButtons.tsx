import { isOnlineGame } from "@/app/utils/gameModeChecks";
import { Button } from "../ui/button";
import OnlineGameButtons from "./onlineGameButtons";
import LocalGameButtons from "./localGameButtons";

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
  if (isOnlineGame) {
    return (
      <OnlineGameButtons
        isGameOver={isGameOver}
        rematchOffered={rematchOffered}
        rematchRequested={rematchRequested}
        onAcceptRematch={onAcceptRematch}
        onDeclineRematch={onDeclineRematch}
        onRequestRematch={onRequestRematch}
        onLeaveRoom={onLeaveRoom}
      />
    );
  }

  if (isLocalGame) {
    return <LocalGameButtons resetGame={resetGame} exitGame={exitGame} />;
  }

  // Fallback to local game buttons for any other case
  return <LocalGameButtons resetGame={resetGame} exitGame={exitGame} />;
};

export default GameButtons;
