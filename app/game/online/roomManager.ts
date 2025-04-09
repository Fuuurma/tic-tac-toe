/**
 * Manages the collection of active game rooms.
 */

import { GameRoom } from "@/app/types/types";
import { createOnlineGameState } from "./createOnlineGameState";

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

    // TODO:
    // If no room with 1 player, check for truly empty rooms that might exist transiently (less likely needed)
    // for (const room of this.rooms.values()) { ... }

    // If no suitable waiting room, create a new one.
    return this.createNewRoom();
  }

  /**
   * Creates a new, empty GameRoom and adds it to the manager.
   * @returns The newly created GameRoom.
   */
  private createNewRoom(): GameRoom {
    const newRoomId = this.createRoomName();

    const newRoom: GameRoom = {
      id: newRoomId,
      playerSocketIds: new Set(),
      state: createOnlineGameState(),
      rematchState: "none",
      rematchRequesterSymbol: null,
    };

    this.rooms.set(newRoomId, newRoom);
    console.log(`[RoomManager] Created new room: ${newRoomId}`);

    return newRoom;
  }

  /**
   * Retrieves a room by its ID.
   * @param roomId The ID of the room to retrieve.
   * @returns The GameRoom if found, otherwise undefined.
   */
  public getRoomById(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Deletes a room by its ID.
   * @param roomId The ID of the room to delete.
   * @returns True if the room was deleted, false otherwise.
   */
  public deleteRoom(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    if (deleted) {
      console.log(`[RoomManager] Deleted room: ${roomId}`);
    }
    return deleted;
  }

  /**
   * Gets the total number of active rooms.
   * @returns The number of rooms.
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }

  private createRoomName(): string {
    return `room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }

  // Optional: Add methods to get all rooms, iterate, etc. if needed for admin/debug
}
