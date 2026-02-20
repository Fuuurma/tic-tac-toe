"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { RotateCcw, LogOut } from "lucide-react";
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
      <div className="flex gap-3 w-full justify-center">
        <Button
          onClick={() => setShowResetConfirm(true)}
          variant="outline"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          New Game
        </Button>
        <Button
          onClick={() => setShowExitConfirm(true)}
          variant="destructive"
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Exit
        </Button>
      </div>

      <ConfirmationDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => resetGame()}
        title="New Game"
        description="Start a fresh game? Current progress will be lost."
        confirmText="New Game"
      />

      <ConfirmationDialog
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => exitGame()}
        title="Exit Game"
        description="Are you sure you want to exit? Current progress will be lost."
        confirmText="Exit"
      />
    </>
  );
};

export default LocalGameButtons;
