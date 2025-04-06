"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import ConfirmationDialog from "./confirmDialog";

interface OnlineGameButtonsProps {
  isGameOver: boolean;
  rematchOffered: boolean;
  rematchRequested: boolean;
  onAcceptRematch: () => void;
  onDeclineRematch: () => void;
  onRequestRematch: () => void;
  onLeaveRoom: () => void;
}

const OnlineGameButtons: React.FC<OnlineGameButtonsProps> = ({
  isGameOver,
  rematchOffered,
  rematchRequested,
  onAcceptRematch,
  onDeclineRematch,
  onRequestRematch,
  onLeaveRoom,
}) => {
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Game over scenarios
  if (isGameOver) {
    if (rematchOffered) {
      return (
        <>
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
              onClick={() => setShowLeaveConfirm(true)}
              variant="destructive"
              className="flex-1"
            >
              Leave Room
            </Button>
          </div>

          <ConfirmationDialog
            isOpen={showLeaveConfirm}
            onClose={() => setShowLeaveConfirm(false)}
            onConfirm={() => {
              onLeaveRoom();
              setShowLeaveConfirm(false);
            }}
            title="Leave Room"
            description="Are you sure you want to leave the room?"
            confirmText="Leave"
          />
        </>
      );
    } else if (rematchRequested) {
      return (
        <>
          <div className="flex gap-2 w-full items-center">
            <span className="text-sm text-muted-foreground flex-1 text-center">
              Waiting for opponent...
            </span>
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              variant="destructive"
            >
              Leave Room
            </Button>
          </div>

          <ConfirmationDialog
            isOpen={showLeaveConfirm}
            onClose={() => setShowLeaveConfirm(false)}
            onConfirm={() => {
              onLeaveRoom();
              setShowLeaveConfirm(false);
            }}
            title="Leave Room"
            description="Are you sure you want to leave the room? Your rematch request will be canceled."
            confirmText="Leave"
          />
        </>
      );
    } else {
      return (
        <>
          <div className="flex gap-2 w-full">
            <Button onClick={onRequestRematch} className="flex-1">
              Request Rematch
            </Button>
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              variant="destructive"
              className="flex-1"
            >
              Leave Room
            </Button>
          </div>

          <ConfirmationDialog
            isOpen={showLeaveConfirm}
            onClose={() => setShowLeaveConfirm(false)}
            onConfirm={() => {
              onLeaveRoom();
              setShowLeaveConfirm(false);
            }}
            title="Leave Room"
            description="Are you sure you want to leave the room?"
            confirmText="Leave"
          />
        </>
      );
    }
  }

  // Active online game
  return (
    <>
      <div className="flex gap-2 w-full">
        <Button variant="outline" disabled className="flex-1">
          Reset (N/A)
        </Button>
        <Button
          onClick={() => setShowLeaveConfirm(true)}
          variant="destructive"
          className="flex-1"
        >
          Exit Game
        </Button>
      </div>

      <ConfirmationDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => {
          onLeaveRoom();
          setShowLeaveConfirm(false);
        }}
        title="Leave Game"
        description="Are you sure you want to leave this game? Your opponent will win by forfeit."
        confirmText="Leave Game"
      />
    </>
  );
};
export default OnlineGameButtons;
