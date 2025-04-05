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
): void => {
  if (existingSocket) return;

  // Initialize the socket API endpoint
  fetch("/api/socket")
    .then(() => {
      const newSocket = io({
        path: "/api/socket",
        addTrailingSlash: false,
      });

      setSocket(newSocket);

      // Once connected, log in
      newSocket.on("connect", () => {
        newSocket.emit("login", username, gameMode);
      });
    })
    .catch((err) => {
      console.error("Socket initialization error:", err);
    });
};
