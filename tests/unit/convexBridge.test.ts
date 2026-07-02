import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { Color, PlayerSymbol } from "@/src/game/core";

const require = createRequire(import.meta.url);
const {
  SocketConvexBridge,
  toConvexPlayer,
} = require("../../server/convexBridge");

const createFakeRoom = () => ({
  id: "socket-room-1",
  gameState: {
    moveCount: 3,
  },
});

const createFakePlayer = (overrides = {}) => ({
  username: "Guest Alpha",
  color: Color.GREEN,
  symbol: PlayerSymbol.X,
  guestId: "guest:alpha-1234",
  identityKind: "guest",
  ...overrides,
});

describe("SocketConvexBridge", () => {
  it("maps socket players to Convex player snapshots", () => {
    expect(toConvexPlayer(createFakePlayer())).toEqual({
      guestId: "guest:alpha-1234",
      profileId: undefined,
      userId: undefined,
      displayNameSnapshot: "Guest Alpha",
      color: Color.GREEN,
    });

    expect(toConvexPlayer(createFakePlayer({ guestId: undefined }))).toBeNull();
  });

  it("creates a room, joins a second player, and records moves with a fake client", async () => {
    const calls: Array<{ ref: string; args: unknown }> = [];
    const fakeClient = {
      mutation: async (ref: string, args: unknown) => {
        calls.push({ ref, args });
        if (ref === "rooms:createRoom") {
          return { roomId: "convex-room-1", code: "ABCD1234" };
        }
        if (ref === "rooms:joinByCode") {
          return { roomId: "convex-room-1" };
        }
        return {};
      },
    };
    const bridge = new SocketConvexBridge({
      clientFactory: () => fakeClient,
      functionRefs: {
        createRoom: "rooms:createRoom",
        joinByCode: "rooms:joinByCode",
        recordMove: "moves:recordMove",
        leaveRoom: "rooms:leaveRoom",
        updateRoomStatus: "rooms:updateRoomStatus",
      },
    });
    const room = createFakeRoom();

    await bridge.ensureRoom(room, createFakePlayer());
    await bridge.ensureRoom(room, createFakePlayer({
      username: "Guest Beta",
      symbol: PlayerSymbol.O,
      guestId: "guest:beta-1234",
      color: Color.PURPLE,
    }));
    await bridge.recordMove(room, createFakePlayer(), 4);

    expect(calls.map((call) => call.ref)).toEqual([
      "rooms:createRoom",
      "rooms:joinByCode",
      "moves:recordMove",
    ]);
    expect(calls[2].args).toMatchObject({
      roomId: "convex-room-1",
      cellIndex: 4,
      moveNumber: 3,
      player: {
        guestId: "guest:alpha-1234",
        playerSymbol: PlayerSymbol.X,
      },
    });
  });
});
