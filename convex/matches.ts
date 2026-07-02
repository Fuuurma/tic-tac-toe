import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireIdentity } from "./model";

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

function historyLimit(limit: number | undefined) {
  if (!limit) return DEFAULT_HISTORY_LIMIT;
  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.floor(limit)));
}

function byMostRecent(matches: Array<Doc<"matches">>) {
  return [...matches].sort((left, right) => right.completedAt - left.completedAt);
}

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_completedAt")
      .order("desc")
      .take(historyLimit(args.limit));
  },
});

export const listForPlayer = query({
  args: {
    profileId: v.optional(v.id("profiles")),
    guestId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireIdentity(args);
    const limit = historyLimit(args.limit);
    const matchesById = new Map<Id<"matches">, Doc<"matches">>();

    if (args.profileId) {
      const [wins, losses] = await Promise.all([
        ctx.db
          .query("matches")
          .withIndex("by_winnerProfileId", (q) => q.eq("winnerProfileId", args.profileId))
          .collect(),
        ctx.db
          .query("matches")
          .withIndex("by_loserProfileId", (q) => q.eq("loserProfileId", args.profileId))
          .collect(),
      ]);

      for (const match of [...wins, ...losses]) {
        matchesById.set(match._id, match);
      }
    }

    if (args.guestId) {
      const [wins, losses] = await Promise.all([
        ctx.db
          .query("matches")
          .withIndex("by_winnerGuestId", (q) => q.eq("winnerGuestId", args.guestId))
          .collect(),
        ctx.db
          .query("matches")
          .withIndex("by_loserGuestId", (q) => q.eq("loserGuestId", args.guestId))
          .collect(),
      ]);

      for (const match of [...wins, ...losses]) {
        matchesById.set(match._id, match);
      }
    }

    return byMostRecent([...matchesById.values()]).slice(0, limit);
  },
});
