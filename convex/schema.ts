import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const identityFields = {
  profileId: v.optional(v.id("profiles")),
  guestId: v.optional(v.string()),
  userId: v.optional(v.string()),
  displayNameSnapshot: v.string(),
};

export default defineSchema({
  profiles: defineTable({
    userId: v.optional(v.string()),
    guestId: v.optional(v.string()),
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_guestId", ["guestId"])
    .index("by_userId", ["userId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),

  profileClaims: defineTable({
    profileId: v.id("profiles"),
    guestId: v.string(),
    userId: v.string(),
    claimedAt: v.number(),
  })
    .index("by_guestId", ["guestId"])
    .index("by_userId", ["userId"])
    .index("by_profileId", ["profileId"]),

  rooms: defineTable({
    code: v.optional(v.string()),
    status: v.union(v.literal("waiting"), v.literal("active"), v.literal("completed")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByProfileId: v.optional(v.id("profiles")),
    createdByGuestId: v.optional(v.string()),
    currentMatchId: v.optional(v.id("matches")),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_createdByGuestId", ["createdByGuestId"]),

  roomPlayers: defineTable({
    roomId: v.id("rooms"),
    ...identityFields,
    symbol: v.union(v.literal("X"), v.literal("O")),
    color: v.optional(v.string()),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
  })
    .index("by_roomId", ["roomId"])
    .index("by_roomId_symbol", ["roomId", "symbol"])
    .index("by_guestId", ["guestId"])
    .index("by_profileId", ["profileId"]),

  moves: defineTable({
    roomId: v.optional(v.id("rooms")),
    matchId: v.optional(v.id("matches")),
    ...identityFields,
    playerSymbol: v.union(v.literal("X"), v.literal("O")),
    cellIndex: v.number(),
    moveNumber: v.number(),
    createdAt: v.number(),
  })
    .index("by_roomId", ["roomId"])
    .index("by_matchId", ["matchId"])
    .index("by_guestId", ["guestId"])
    .index("by_profileId", ["profileId"]),

  matches: defineTable({
    roomId: v.optional(v.id("rooms")),
    gameMode: v.string(),
    source: v.union(v.literal("socket"), v.literal("local"), v.literal("ai"), v.literal("manual")),
    winnerProfileId: v.optional(v.id("profiles")),
    winnerGuestId: v.optional(v.string()),
    winnerDisplayNameSnapshot: v.optional(v.string()),
    loserProfileId: v.optional(v.id("profiles")),
    loserGuestId: v.optional(v.string()),
    loserDisplayNameSnapshot: v.optional(v.string()),
    movesCount: v.number(),
    completedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_winnerGuestId", ["winnerGuestId"])
    .index("by_winnerProfileId", ["winnerProfileId"])
    .index("by_completedAt", ["completedAt"]),

  playerStats: defineTable({
    profileId: v.optional(v.id("profiles")),
    guestId: v.optional(v.string()),
    displayNameSnapshot: v.string(),
    gamesPlayed: v.number(),
    wins: v.number(),
    losses: v.number(),
    currentStreak: v.number(),
    bestStreak: v.number(),
    updatedAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_guestId", ["guestId"]),

  roomInvites: defineTable({
    roomId: v.id("rooms"),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    usedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_roomId", ["roomId"]),
});
