"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import ConfirmationDialog from "./confirmDialog";

interface LocalGameButtonsProps {
  resetGame: () => void;
  exitGame: () => void;
}

const LocalGameButtons: React.FC<LocalGameButtonsProps> = ({
  resetGame,
  exitGame,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  return (
    <>
      <div className="flex gap-2 w-full">
        <Button
          onClick={() => setShowResetConfirm(true)}
          variant="outline"
          className="flex-1"
        >
          Reset Game
        </Button>
        <Button
          onClick={() => setShowExitConfirm(true)}
          variant="destructive"
          className="flex-1"
        >
          Exit Game
        </Button>
      </div>

      <ConfirmationDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          resetGame();
          setShowResetConfirm(false);
        }}
        title="Reset Game"
        description="Are you sure you want to reset the game? Current progress will be lost."
        confirmText="Reset"
      />

      <ConfirmationDialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => {
          exitGame();
          setShowExitConfirm(false);
        }}
        title="Exit Game"
        description="Are you sure you want to exit the game? Current progress will be lost."
        confirmText="Exit"
      />
    </>
  );
};

export default LocalGameButtons;
