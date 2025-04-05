import { GameModes } from "../game/constants/constants";
import { GameMode } from "../types/types";
import { Socket } from "socket.io-client";

export const cleanupSocketConnection = (
  gameMode: GameMode,
  socket: Socket | null
) => {
  if (gameMode !== GameModes.ONLINE && socket) {
    socket.disconnect();
  }
};
