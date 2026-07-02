import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { playerIdentityArgs, playerSymbolValidator, requireDisplayName, requireIdentity } from "./model";

const movePlayerArgs = {
  ...playerIdentityArgs,
  playerSymbol: playerSymbolValidator,
};

export const recordMove = mutation({
  args: {
    roomId: v.optional(v.id("rooms")),
    matchId: v.optional(v.id("matches")),
    player: v.object(movePlayerArgs),
    cellIndex: v.number(),
    moveNumber: v.number(),
  },
  handler: async (ctx, args) => {
    if (!args.roomId && !args.matchId) {
      throw new Error("A roomId or matchId is required.");
    }

    if (!Number.isInteger(args.cellIndex) || args.cellIndex < 0 || args.cellIndex > 8) {
      throw new Error("Invalid cell index.");
    }

    if (!Number.isInteger(args.moveNumber) || args.moveNumber < 1) {
      throw new Error("Invalid move number.");
    }

    requireIdentity(args.player);
    const now = Date.now();

    return await ctx.db.insert("moves", {
      roomId: args.roomId,
      matchId: args.matchId,
      profileId: args.player.profileId,
      guestId: args.player.guestId,
      userId: args.player.userId,
      displayNameSnapshot: requireDisplayName(args.player.displayNameSnapshot),
      playerSymbol: args.player.playerSymbol,
      cellIndex: args.cellIndex,
      moveNumber: args.moveNumber,
      createdAt: now,
    });
  },
});
