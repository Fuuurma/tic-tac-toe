import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireDisplayName, requireIdentity } from "./model";
import { mergeGuestStatsIntoProfile } from "./stats";

export const upsertGuestProfile = mutation({
  args: {
    guestId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const displayName = requireDisplayName(args.displayName);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName,
        updatedAt: now,
        lastSeenAt: now,
      });
      return await ctx.db.get(existing._id);
    }

    const profileId = await ctx.db.insert("profiles", {
      guestId: args.guestId,
      displayName,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });

    return await ctx.db.get(profileId);
  },
});

export const getMineOrGuest = query({
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
      if (accountProfile) return accountProfile;
    }

    if (!args.guestId) return null;

    return await ctx.db
      .query("profiles")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();
  },
});

export const updateDisplayName = mutation({
  args: {
    profileId: v.optional(v.id("profiles")),
    guestId: v.optional(v.string()),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    requireIdentity(args);
    const displayName = requireDisplayName(args.displayName);
    const now = Date.now();
    const profile = args.profileId
      ? await ctx.db.get(args.profileId)
      : await ctx.db
          .query("profiles")
          .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
          .unique();

    if (!profile) {
      throw new Error("Profile not found.");
    }

    await ctx.db.patch(profile._id, {
      displayName,
      updatedAt: now,
      lastSeenAt: now,
    });

    return await ctx.db.get(profile._id);
  },
});

export const claimGuestProfile = mutation({
  args: {
    guestId: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Sign in is required to claim a guest profile.");
    }

    const now = Date.now();
    const existingClaim = await ctx.db
      .query("profileClaims")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .first();

    if (existingClaim) {
      if (existingClaim.userId !== identity.subject) {
        throw new Error("Guest profile is already claimed by another account.");
      }

      const claimedProfile = await ctx.db.get(existingClaim.profileId);
      if (claimedProfile) return claimedProfile;
    }

    const guestProfile = await ctx.db
      .query("profiles")
      .withIndex("by_guestId", (q) => q.eq("guestId", args.guestId))
      .unique();
    const accountProfile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();

    if (accountProfile) {
      await mergeGuestStatsIntoProfile(ctx, {
        guestId: args.guestId,
        profileId: accountProfile._id,
        displayNameSnapshot: accountProfile.displayName,
        now,
      });
      await ctx.db.insert("profileClaims", {
        profileId: accountProfile._id,
        guestId: args.guestId,
        userId: identity.subject,
        claimedAt: now,
      });
      return accountProfile;
    }

    if (guestProfile) {
      await ctx.db.patch(guestProfile._id, {
        userId: identity.subject,
        displayName: args.displayName
          ? requireDisplayName(args.displayName)
          : guestProfile.displayName,
        updatedAt: now,
        lastSeenAt: now,
      });
      await mergeGuestStatsIntoProfile(ctx, {
        guestId: args.guestId,
        profileId: guestProfile._id,
        displayNameSnapshot: args.displayName
          ? requireDisplayName(args.displayName)
          : guestProfile.displayName,
        now,
      });
      await ctx.db.insert("profileClaims", {
        profileId: guestProfile._id,
        guestId: args.guestId,
        userId: identity.subject,
        claimedAt: now,
      });
      return await ctx.db.get(guestProfile._id);
    }

    const profileId = await ctx.db.insert("profiles", {
      userId: identity.subject,
      guestId: args.guestId,
      displayName: requireDisplayName(args.displayName || "Player"),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });

    await mergeGuestStatsIntoProfile(ctx, {
      guestId: args.guestId,
      profileId,
      displayNameSnapshot: requireDisplayName(args.displayName || "Player"),
      now,
    });

    await ctx.db.insert("profileClaims", {
      profileId,
      guestId: args.guestId,
      userId: identity.subject,
      claimedAt: now,
    });

    return await ctx.db.get(profileId);
  },
});
