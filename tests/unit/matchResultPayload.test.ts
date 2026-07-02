import { describe, expect, it } from "vitest";
import { GameModes, GameStatus, PlayerSymbol } from "@/app/game/constants/constants";
import { buildMatchResultPayload } from "@/app/utils/convex/matchResultPayload";
import { createMockGameState } from "../helpers/gameUtils";

describe("buildMatchResultPayload", () => {
  it("returns a Convex match payload for completed online games with player identities", () => {
    const payload = buildMatchResultPayload(
      createMockGameState({
        gameMode: GameModes.ONLINE,
        gameStatus: GameStatus.COMPLETED,
        winner: PlayerSymbol.X,
        moveCount: 7,
        players: {
          [PlayerSymbol.X]: {
            ...createMockGameState().players[PlayerSymbol.X],
            username: "Ada",
            guestId: "guest:ada",
          },
          [PlayerSymbol.O]: {
            ...createMockGameState().players[PlayerSymbol.O],
            username: "Grace",
            guestId: "guest:grace",
          },
        },
      })
    );

    expect(payload).toEqual({
      gameMode: GameModes.ONLINE,
      source: "socket",
      movesCount: 7,
      winner: {
        guestId: "guest:ada",
        displayNameSnapshot: "Ada",
      },
      loser: {
        guestId: "guest:grace",
        displayNameSnapshot: "Grace",
      },
    });
  });

  it("returns null before a game is completed", () => {
    expect(
      buildMatchResultPayload(
        createMockGameState({
          gameStatus: GameStatus.ACTIVE,
          winner: null,
        })
      )
    ).toBeNull();
  });

  it("returns null when either player is missing identity metadata", () => {
    expect(
      buildMatchResultPayload(
        createMockGameState({
          gameMode: GameModes.ONLINE,
          gameStatus: GameStatus.COMPLETED,
          winner: PlayerSymbol.X,
        })
      )
    ).toBeNull();
  });
});
