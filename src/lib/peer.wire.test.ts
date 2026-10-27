import { describe, expect, it } from "vitest";
import { Color, GameModes, PlayerSymbol } from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import { isPeerMessage, migrateLegacyShapes } from "./peer.wire";

const onlineState = () => {
  const state = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });
  return state;
};

// The trust boundary: what a peer may send, and what is refused.

describe("isPeerMessage", () => {
  it("accepts supported protocol messages", () => {
    expect(isPeerMessage({ type: "move", index: 4 })).toBe(true);
    expect(isPeerMessage({ type: "leave" })).toBe(true);
    expect(isPeerMessage({ type: "rematchCancel" })).toBe(true);
  });

  it("rejects a null protocol envelope", () => {
    expect(isPeerMessage(null)).toBe(false);
  });

  it("accepts rematchRequested with either PlayerSymbol as the requester", () => {
    expect(
      isPeerMessage({ type: "rematchRequested", requesterSymbol: PlayerSymbol.X }),
    ).toBe(true);
    expect(
      isPeerMessage({ type: "rematchRequested", requesterSymbol: PlayerSymbol.O }),
    ).toBe(true);
  });

  it("rejects an `error` frame: the relay reserves that type, so no peer can send one", () => {
    expect(isPeerMessage({ type: "error", message: "Invalid move" })).toBe(false);
    expect(isPeerMessage({ type: "error", code: "invalid", message: "x" })).toBe(false);
  });

  it("round-trips the sync_request/state_snapshot reconnect contract (DST-04)", () => {
    expect(isPeerMessage({ type: "sync_request" })).toBe(true);
    expect(
      isPeerMessage({ type: "state_snapshot", gameState: onlineState() }),
    ).toBe(true);
    // A snapshot is only as good as its payload — malformed states drop.
    expect(isPeerMessage({ type: "state_snapshot" })).toBe(false);
    expect(
      isPeerMessage({ type: "state_snapshot", gameState: { board: [] } }),
    ).toBe(false);
  });
});

describe("migrateLegacyShapes", () => {
  // An older cached client still sends the hexagon the crescent replaced.
  const snapshotWithHexagon = () => {
    const state = onlineState();
    return {
      type: "state_snapshot",
      gameState: {
        ...state,
        players: {
          ...state.players,
          X: { ...state.players.X, shape: "hexagon" },
        },
      },
    };
  };

  it("lets a legacy hexagon through as the crescent instead of dropping the game", () => {
    const msg = snapshotWithHexagon();
    expect(isPeerMessage(msg)).toBe(false);

    migrateLegacyShapes(msg);

    expect(msg.gameState.players.X.shape).toBe("crescent");
    expect(isPeerMessage(msg)).toBe(true);
  });

  it("leaves current shapes, non-game frames and junk alone", () => {
    const msg = { type: "state_snapshot", gameState: onlineState() };
    const before = JSON.stringify(msg);
    migrateLegacyShapes(msg);
    migrateLegacyShapes({ type: "move", index: 4 });
    migrateLegacyShapes(null);
    migrateLegacyShapes("hexagon");
    expect(JSON.stringify(msg)).toBe(before);
  });
});
