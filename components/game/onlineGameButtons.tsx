"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import ConfirmationDialog from "./confirmDialog";
import { Check, Loader2, LogOut, RotateCcw, X } from "lucide-react";

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
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              Accept Rematch
            </Button>
            <Button
              onClick={onDeclineRematch}
              variant="outline"
              className="flex-1 gap-2"
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              variant="destructive"
              className="flex-1 gap-2"
            >
              <LogOut className="h-4 w-4" />
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
          <div className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <span className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Rematch request sent
            </span>
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Leave
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
            <Button onClick={onRequestRematch} className="flex-1 gap-2">
              <RotateCcw className="h-4 w-4" />
              Request Rematch
            </Button>
            <Button
              onClick={() => setShowLeaveConfirm(true)}
              variant="destructive"
              className="flex-1 gap-2"
            >
              <LogOut className="h-4 w-4" />
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
      <div className="flex w-full items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <span className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Online match in progress
        </span>
        <Button
          onClick={() => setShowLeaveConfirm(true)}
          variant="destructive"
          size="sm"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Leave
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
