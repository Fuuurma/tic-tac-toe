import { describe, expect, it } from "vitest";
import { GameStatus, PlayerSymbol } from "@/src/game/core";
import {
  getOnlineStatusMessage,
  getOnlineStatusSnapshot,
  shouldAnnounceOnlineUpdate,
} from "@/src/game/core/online";
import { createMockGameState } from "../helpers/gameUtils";

describe("online status selectors", () => {
  it("builds a stable snapshot from game state", () => {
    const state = createMockGameState({
      currentPlayer: PlayerSymbol.O,
      lastMoveIndex: 4,
    });

    expect(getOnlineStatusSnapshot(state)).toEqual({
      currentPlayer: PlayerSymbol.O,
      winner: null,
      gameStatus: GameStatus.ACTIVE,
      lastMoveIndex: 4,
    });
  });

  it("formats waiting, turn, and winner messages", () => {
    expect(
      getOnlineStatusMessage(createMockGameState({ gameStatus: GameStatus.WAITING }))
    ).toBe("Waiting for opponent...");

    expect(
      getOnlineStatusMessage(createMockGameState({ currentPlayer: PlayerSymbol.O }))
    ).toBe("Player2's turn.");

    expect(
      getOnlineStatusMessage(
        createMockGameState({
          winner: PlayerSymbol.X,
          gameStatus: GameStatus.COMPLETED,
        })
      )
    ).toBe("Player1 wins!");
  });

  it("announces only meaningful online state changes", () => {
    const snapshot = getOnlineStatusSnapshot(createMockGameState());

    expect(shouldAnnounceOnlineUpdate(null, snapshot)).toBe(true);
    expect(shouldAnnounceOnlineUpdate(snapshot, snapshot)).toBe(false);
    expect(
      shouldAnnounceOnlineUpdate(snapshot, {
        ...snapshot,
        lastMoveIndex: 2,
      })
    ).toBe(true);
  });
});
