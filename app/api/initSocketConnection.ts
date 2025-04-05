import {
  ClientToServerEvents,
  GameMode,
  ServerToClientEvents,
} from "../types/types";
import { io, Socket } from "socket.io-client";

export const initializeSocketConnection = (
  username: string,
  gameMode: GameMode,
  existingSocket: Socket | null,
  setSocket: (socket: Socket) => void
): Socket => {
  if (existingSocket) return existingSocket;

  const newSocket = io() as Socket<ServerToClientEvents, ClientToServerEvents>;
  setSocket(newSocket);

  newSocket.emit("login", username, gameMode);
  return newSocket;
};
