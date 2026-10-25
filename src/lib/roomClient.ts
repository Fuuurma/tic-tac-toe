import { RoomSocket } from "@fuurma/online-client";
import type { RoomSocketOptions } from "@fuurma/online-client";

/**
 * S6: the forked `src/lib/room.ts` RoomClient replaced by the shared
 * Tier-1 SDK socket. Same connect/send/close/setMessageHandler/
 * setStatusHandler/reconnectNow surface (plus `closeForReconnect`,
 * `getStatus`, `getRole`, `isConnected`, `setSlotToken`); the only
 * game-specific wiring is the storage prefixes so persisted reconnect
 * and slot tokens survive the swap. No wire-frame changes.
 */

export const ROOM_TOKEN_PREFIX = "tictactoe:room-token:";
export const ROOM_SLOT_TOKEN_PREFIX = "tictactoe:room-slot-token:";

export class RoomClient extends RoomSocket {
  constructor(opts: RoomSocketOptions) {
    super({
      ...opts,
      tokenPrefix: opts.tokenPrefix ?? ROOM_TOKEN_PREFIX,
      slotTokenPrefix: opts.slotTokenPrefix ?? ROOM_SLOT_TOKEN_PREFIX,
    });
  }
}
