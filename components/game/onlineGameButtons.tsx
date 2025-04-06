"use client";

import { useState } from "react";

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

  return (
    <div>
      OnlineGameButtons
      <p>hi</p>
      <p>hi</p>
    </div>
  );
};

export default OnlineGameButtons;
