import { GameState } from "@/app/types/types";
import { computerMove } from "./logic";
import { Socket } from "socket.io-client";
import { PlayerSymbol } from "../constants/constants";

export const handleAI_Move = (
  state: GameState,
  socket: Socket | null,
  onLocalUpdate: (newState: GameState) => void
): (() => void) => {
  const newState = computerMove(state);
  const aiMoveDelay = 600;

  const timer = setTimeout(() => {
    // AI will only be used offline
    if (socket?.connected) {
      const lastMove = newState.moves[PlayerSymbol.O].at(-1);
      socket.emit("move", lastMove);
    } else {
      onLocalUpdate(newState);
    }
  }, aiMoveDelay);

  return () => clearTimeout(timer);
};
