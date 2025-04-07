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
): GameRoom {}
