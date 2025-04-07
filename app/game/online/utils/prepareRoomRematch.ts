import { GameRoom } from "@/app/types/types";
import { isValidPlayerSymbol } from "@/app/utils/isValidSymbol";
import { Socket } from "socket.io";
import { createRematchGameState } from "./createRematchState";
/**
 * Resets a room for a rematch
 * @param room The game room to reset
 * @param playerSocketIds The socket IDs of players in the room
 * @param getPlayerSocket Function to get player socket from ID
 * @returns The updated room state
 */

export function prepareRoomForRematch(
  room: GameRoom,
  playerSocketIds: Set<string>,
  getPlayerSocket: (socketId: string) => Socket | undefined
): GameRoom {
  const currentPlayersData = { ...room.state.players };

  // Reset game state but keep player info
  room.state = createRematchGameState(currentPlayersData);

  // Ensure players are marked active
  Array.from(playerSocketIds).forEach((socketId) => {
    const playerSocket = getPlayerSocket(socketId);
    const symbol = playerSocket?.data.symbol;
    if (isValidPlayerSymbol(symbol)) {
      room.state.players[symbol].isActive = true;
    }
  });

  room.rematchState = "none";
  room.rematchRequesterSymbol = null;

  return room;
}
