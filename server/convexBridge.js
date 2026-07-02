const DEFAULT_CONVEX_URL = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "";

function identityKey(player) {
  if (player.profileId) return `profile:${player.profileId}`;
  if (player.guestId) return `guest:${player.guestId}`;
  return null;
}

function toConvexPlayer(player) {
  if (!player) return null;

  const key = identityKey(player);
  if (!key) return null;

  return {
    profileId: player.profileId,
    guestId: player.guestId,
    userId: player.userId,
    displayNameSnapshot: player.username,
    color: player.color,
  };
}

class SocketConvexBridge {
  constructor({ url = DEFAULT_CONVEX_URL, log = () => {}, clientFactory = null, functionRefs = null } = {}) {
    this.url = url;
    this.log = log;
    this.clientFactory = clientFactory;
    this.functionRefs = functionRefs;
    this.clientPromise = null;
    this.rooms = new Map();
  }

  get enabled() {
    return Boolean(this.url || this.clientFactory);
  }

  async getClient() {
    if (!this.enabled) return null;

    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        if (this.clientFactory) {
          return this.clientFactory();
        }

        const [{ ConvexHttpClient }, { makeFunctionReference }] = await Promise.all([
          import("convex/browser"),
          import("convex/server"),
        ]);

        this.functionRefs = {
          createRoom: makeFunctionReference("rooms:createRoom"),
          joinByCode: makeFunctionReference("rooms:joinByCode"),
          leaveRoom: makeFunctionReference("rooms:leaveRoom"),
          recordMove: makeFunctionReference("moves:recordMove"),
          updateRoomStatus: makeFunctionReference("rooms:updateRoomStatus"),
          ...(this.functionRefs || {}),
        };

        return new ConvexHttpClient(this.url);
      })();
    }

    return await this.clientPromise;
  }

  async run(label, task) {
    if (!this.enabled) return null;

    try {
      return await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log("warn", `Convex bridge ${label} failed: ${message}`);
      return null;
    }
  }

  async ensureRoom(room, player) {
    if (!this.enabled) return null;

    const convexPlayer = toConvexPlayer(player);
    if (!convexPlayer) return null;

    const key = identityKey(player);
    const trackedRoom = this.rooms.get(room.id);
    if (trackedRoom?.joinedKeys.has(key)) {
      return trackedRoom;
    }

    return await this.run("ensureRoom", async () => {
      const client = await this.getClient();
      if (!client) return null;

      if (!trackedRoom) {
        const created = await client.mutation(this.functionRefs.createRoom, {
          player: convexPlayer,
          symbol: player.symbol,
        });
        const nextTrackedRoom = {
          roomId: created.roomId,
          code: created.code,
          joinedKeys: new Set([key]),
        };
        this.rooms.set(room.id, nextTrackedRoom);
        return nextTrackedRoom;
      }

      const joined = await client.mutation(this.functionRefs.joinByCode, {
        code: trackedRoom.code,
        player: convexPlayer,
      });
      trackedRoom.joinedKeys.add(key);
      trackedRoom.roomId = joined.roomId;
      return trackedRoom;
    });
  }

  handlePlayerJoined(room, player) {
    return this.ensureRoom(room, player);
  }

  handlePlayerLeft(room, player) {
    return this.run("leaveRoom", async () => {
      const trackedRoom = this.rooms.get(room.id);
      const key = identityKey(player);
      if (!trackedRoom || !key) return null;

      const client = await this.getClient();
      if (!client) return null;

      const result = await client.mutation(this.functionRefs.leaveRoom, {
        roomId: trackedRoom.roomId,
        profileId: player.profileId,
        guestId: player.guestId,
      });
      trackedRoom.joinedKeys.delete(key);
      return result;
    });
  }

  updateRoomStatus(room, status) {
    return this.run("updateRoomStatus", async () => {
      const trackedRoom = this.rooms.get(room.id);
      if (!trackedRoom) return null;

      const client = await this.getClient();
      if (!client) return null;

      return await client.mutation(this.functionRefs.updateRoomStatus, {
        roomId: trackedRoom.roomId,
        status,
      });
    });
  }

  recordMove(room, player, cellIndex) {
    return this.run("recordMove", async () => {
      const trackedRoom = await this.ensureRoom(room, player);
      const convexPlayer = toConvexPlayer(player);
      if (!trackedRoom || !convexPlayer) return null;

      const client = await this.getClient();
      if (!client) return null;

      return await client.mutation(this.functionRefs.recordMove, {
        roomId: trackedRoom.roomId,
        player: {
          ...convexPlayer,
          playerSymbol: player.symbol,
        },
        cellIndex,
        moveNumber: room.gameState.moveCount,
      });
    });
  }

  forgetRoom(room) {
    this.rooms.delete(room.id);
  }
}

function createSocketConvexBridge(options = {}) {
  return new SocketConvexBridge(options);
}

module.exports = {
  SocketConvexBridge,
  createSocketConvexBridge,
  toConvexPlayer,
};
