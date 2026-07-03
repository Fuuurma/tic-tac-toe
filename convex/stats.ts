import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireIdentity } from "./model";

const playerResultArgs = {
  profileId: v.optional(v.id("profiles")),
  guestId: v.optional(v.string()),
  displayNameSnapshot: v.string(),
};

async function getStatsDoc(
  ctx: MutationCtx | QueryCtx,
  identity: { profileId?: Id<"profiles">; guestId?: string }
) {
  if (identity.profileId) {
    return await ctx.db
      .query("playerStats")
      .withIndex("by_profileId", (q) => q.eq("profileId", identity.profileId))
      .unique();
  }

  if (identity.guestId) {
    return await ctx.db
      .query("playerStats")
      .withIndex("by_guestId", (q) => q.eq("guestId", identity.guestId))
      .unique();
  }

  return null;
}

async function applyResult(
  ctx: MutationCtx,
  player: {
    profileId?: Id<"profiles">;
    guestId?: string;
    displayNameSnapshot: string;
  },
  didWin: boolean,
  now: number
) {
  requireIdentity(player);
  const current = await getStatsDoc(ctx, player);
  const nextCurrentStreak = didWin ? (current?.currentStreak || 0) + 1 : 0;
  const patch = {
    displayNameSnapshot: player.displayNameSnapshot,
    gamesPlayed: (current?.gamesPlayed || 0) + 1,
    wins: (current?.wins || 0) + (didWin ? 1 : 0),
    losses: (current?.losses || 0) + (didWin ? 0 : 1),
    currentStreak: nextCurrentStreak,
    bestStreak: Math.max(current?.bestStreak || 0, nextCurrentStreak),
    updatedAt: now,
  };

  if (current) {
    await ctx.db.patch(current._id, patch);
    return current._id;
  }

  return await ctx.db.insert("playerStats", {
    profileId: player.profileId,
    guestId: player.guestId,
    ...patch,
  });
}

export function combinePlayerStats(
  profileStats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    currentStreak: number;
    bestStreak: number;
  } | null,
  guestStats: {
    gamesPlayed: number;
    wins: number;
    losses: number;
    currentStreak: number;
    bestStreak: number;
  },
  displayNameSnapshot: string,
  now: number
) {
  return {
    displayNameSnapshot,
    gamesPlayed: (profileStats?.gamesPlayed || 0) + guestStats.gamesPlayed,
    wins: (profileStats?.wins || 0) + guestStats.wins,
    losses: (profileStats?.losses || 0) + guestStats.losses,
    currentStreak: Math.max(profileStats?.currentStreak || 0, guestStats.currentStreak),
    bestStreak: Math.max(profileStats?.bestStreak || 0, guestStats.bestStreak),
    updatedAt: now,
  };
}

export async function mergeGuestStatsIntoProfile(
  ctx: MutationCtx,
  args: {
    guestId: string;
    profileId: Id<"profiles">;
    displayNameSnapshot: string;
    now: number;
  }
) {
  const guestStats = await getStatsDoc(ctx, { guestId: args.guestId });
  if (!guestStats) return null;

  const profileStats = await getStatsDoc(ctx, { profileId: args.profileId });

  if (profileStats?._id === guestStats._id) {
    await ctx.db.patch(guestStats._id, {
      profileId: args.profileId,
      displayNameSnapshot: args.displayNameSnapshot,
      updatedAt: args.now,
    });
    return guestStats._id;
  }

  if (profileStats) {
    await ctx.db.patch(
      profileStats._id,
      combinePlayerStats(profileStats, guestStats, args.displayNameSnapshot, args.now)
    );
    await ctx.db.delete(guestStats._id);
    return profileStats._id;
  }

  await ctx.db.patch(guestStats._id, {
    profileId: args.profileId,
    displayNameSnapshot: args.displayNameSnapshot,
    updatedAt: args.now,
  });
  return guestStats._id;
}

export const getByProfile = query({
  args: {
    profileId: v.optional(v.id("profiles")),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireIdentity(args);
    return await getStatsDoc(ctx, args);
  },
});

export const getMine = query({
  args: {
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      const accountProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .unique();

      if (accountProfile) {
        return await getStatsDoc(ctx, { profileId: accountProfile._id });
      }
    }

    if (!args.guestId) return null;
    return await getStatsDoc(ctx, { guestId: args.guestId });
  },
});

export const recordMatchResult = mutation({
  args: {
    roomId: v.optional(v.id("rooms")),
    gameMode: v.string(),
    source: v.optional(v.union(v.literal("socket"), v.literal("local"), v.literal("ai"), v.literal("manual"))),
    movesCount: v.number(),
    dedupeKey: v.optional(v.string()),
    winner: v.object(playerResultArgs),
    loser: v.object(playerResultArgs),
  },
  handler: async (ctx, args) => {
    requireIdentity(args.winner);
    requireIdentity(args.loser);

    const now = Date.now();
    if (args.dedupeKey) {
      const existingMatch = await ctx.db
        .query("matches")
        .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
        .unique();

      if (existingMatch) {
        return { matchId: existingMatch._id, winnerStatsId: null, loserStatsId: null, deduped: true };
      }
    }

    const matchId = await ctx.db.insert("matches", {
      roomId: args.roomId,
      gameMode: args.gameMode,
      source: args.source || "socket",
      winnerProfileId: args.winner.profileId,
      winnerGuestId: args.winner.guestId,
      winnerDisplayNameSnapshot: args.winner.displayNameSnapshot,
      loserProfileId: args.loser.profileId,
      loserGuestId: args.loser.guestId,
      loserDisplayNameSnapshot: args.loser.displayNameSnapshot,
      movesCount: args.movesCount,
      dedupeKey: args.dedupeKey,
      completedAt: now,
      createdAt: now,
    });

    const winnerStatsId = await applyResult(ctx, args.winner, true, now);
    const loserStatsId = await applyResult(ctx, args.loser, false, now);

    return { matchId, winnerStatsId, loserStatsId, deduped: false };
  },
});
