import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  createRoomCode,
  normalizeRoomCode,
  playerIdentityArgs,
  playerSymbolValidator,
  requireDisplayName,
  requireIdentity,
  roomStatusValidator,
} from "./model";

type PlayerSymbol = "X" | "O";

type RoomPlayerIdentity = {
  profileId?: Id<"profiles">;
  guestId?: string;
  userId?: string;
  displayNameSnapshot: string;
};

const playerArgs = {
  ...playerIdentityArgs,
  color: v.optional(v.string()),
};

function sanitizePlayer(args: RoomPlayerIdentity) {
  requireIdentity(args);
  return {
    profileId: args.profileId,
    guestId: args.guestId,
    userId: args.userId,
    displayNameSnapshot: requireDisplayName(args.displayNameSnapshot),
  };
}

async function getRoomByCode(ctx: QueryCtx | MutationCtx, code: string) {
  return await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", normalizeRoomCode(code)))
    .unique();
}

async function activeRoomPlayers(ctx: QueryCtx | MutationCtx, roomId: Id<"rooms">) {
  const players = await ctx.db
    .query("roomPlayers")
    .withIndex("by_roomId", (q) => q.eq("roomId", roomId))
    .collect();

  return players.filter((player) => player.leftAt === undefined);
}

async function findActiveRoomPlayer(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  identity: { profileId?: Id<"profiles">; guestId?: string }
) {
  const players = await activeRoomPlayers(ctx, roomId);
  return players.find((player) => {
    if (identity.profileId && player.profileId === identity.profileId) return true;
    if (identity.guestId && player.guestId === identity.guestId) return true;
    return false;
  });
}

function nextAvailableSymbol(activePlayers: Array<{ symbol: PlayerSymbol }>): PlayerSymbol | null {
  const takenSymbols = new Set(activePlayers.map((player) => player.symbol));
  if (!takenSymbols.has("X")) return "X";
  if (!takenSymbols.has("O")) return "O";
  return null;
}

async function insertRoomPlayer(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  symbol: PlayerSymbol,
  args: RoomPlayerIdentity & { color?: string },
  now: number
) {
  const player = sanitizePlayer(args);
  return await ctx.db.insert("roomPlayers", {
    roomId,
    ...player,
    symbol,
    color: args.color,
    joinedAt: now,
  });
}

export const createRoom = mutation({
  args: {
    player: v.object(playerArgs),
    code: v.optional(v.string()),
    symbol: v.optional(playerSymbolValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const requestedCode = args.code ? normalizeRoomCode(args.code) : createRoomCode(now);
    const existingRoom = await getRoomByCode(ctx, requestedCode);

    if (existingRoom) {
      throw new Error("Room code is already in use.");
    }

    const player = sanitizePlayer(args.player);
    const roomId = await ctx.db.insert("rooms", {
      code: requestedCode,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
      createdByProfileId: player.profileId,
      createdByGuestId: player.guestId,
    });

    await ctx.db.insert("roomInvites", {
      roomId,
      code: requestedCode,
      createdAt: now,
    });

    const symbol = args.symbol || "X";
    const roomPlayerId = await insertRoomPlayer(ctx, roomId, symbol, args.player, now);

    return { roomId, roomPlayerId, code: requestedCode, symbol, status: "waiting" as const };
  },
});

export const joinByCode = mutation({
  args: {
    code: v.string(),
    player: v.object(playerArgs),
  },
  handler: async (ctx, args) => {
    const room = await getRoomByCode(ctx, args.code);
    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.status === "completed") {
      throw new Error("Room is already completed.");
    }

    const now = Date.now();
    const player = sanitizePlayer(args.player);
    const existingPlayer = await findActiveRoomPlayer(ctx, room._id, player);
    if (existingPlayer) {
      return {
        roomId: room._id,
        roomPlayerId: existingPlayer._id,
        code: room.code,
        symbol: existingPlayer.symbol,
        status: room.status,
      };
    }

    const activePlayers = await activeRoomPlayers(ctx, room._id);
    const symbol = nextAvailableSymbol(activePlayers);
    if (!symbol) {
      throw new Error("Room is full.");
    }

    const roomPlayerId = await insertRoomPlayer(ctx, room._id, symbol, args.player, now);
    const nextStatus = activePlayers.length + 1 >= 2 ? "active" : "waiting";

    await ctx.db.patch(room._id, {
      status: nextStatus,
      updatedAt: now,
    });

    return { roomId: room._id, roomPlayerId, code: room.code, symbol, status: nextStatus };
  },
});

export const leaveRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    profileId: v.optional(v.id("profiles")),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireIdentity(args);
    const now = Date.now();
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found.");
    }

    const roomPlayer = await findActiveRoomPlayer(ctx, args.roomId, args);
    if (!roomPlayer) {
      return { roomId: args.roomId, left: false, status: room.status };
    }

    await ctx.db.patch(roomPlayer._id, { leftAt: now });
    const remainingPlayers = (await activeRoomPlayers(ctx, args.roomId)).filter(
      (player) => player._id !== roomPlayer._id
    );
    const nextStatus = remainingPlayers.length >= 2 ? "active" : "waiting";
    await ctx.db.patch(args.roomId, {
      status: nextStatus,
      updatedAt: now,
    });

    return { roomId: args.roomId, left: true, status: nextStatus };
  },
});

export const updateRoomStatus = mutation({
  args: {
    roomId: v.id("rooms"),
    status: roomStatusValidator,
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) {
      throw new Error("Room not found.");
    }

    await ctx.db.patch(args.roomId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(args.roomId);
  },
});

export const getRoom = query({
  args: {
    roomId: v.optional(v.id("rooms")),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const room = args.roomId
      ? await ctx.db.get(args.roomId)
      : args.code
        ? await getRoomByCode(ctx, args.code)
        : null;

    if (!room) return null;

    const [players, moves, invites] = await Promise.all([
      ctx.db
        .query("roomPlayers")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
        .collect(),
      ctx.db
        .query("moves")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
        .collect(),
      ctx.db
        .query("roomInvites")
        .withIndex("by_roomId", (q) => q.eq("roomId", room._id))
        .collect(),
    ]);

    return { room, players, moves, invites };
  },
});
