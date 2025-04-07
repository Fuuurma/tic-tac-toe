/**
 * Manages the collection of active game rooms.
 */

import { GameRoom } from "@/app/types/types";

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();

  /**
   * Finds an existing room with less than 2 players or creates a new one.
   * @returns The found or newly created GameRoom.
   */
  public findAvailableRoomOrCreate(): GameRoom {
    for (const room of this.rooms.values()) {
      // Ensure room exists and check player count
      if (
        room &&
        room.playerSocketIds.size < 2 &&
        room.playerSocketIds.size > 0
      ) {
        // Prioritize rooms with 1 player waiting
        console.log(`[RoomManager] Found waiting room: ${room.id}`);
        return room;
      }
    }
    // If no room with 1 player, check for truly empty rooms that might exist transiently (less likely needed)
    // for (const room of this.rooms.values()) { ... }

    // If no suitable waiting room, create a new one.
    return this.createNewRoom();
  }
}
