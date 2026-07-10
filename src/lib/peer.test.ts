import { describe, expect, it } from "vitest";
import { Color, GameModes, PlayerSymbol } from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import { applyAuthorizedMove, isPeerMessage } from "@/lib/peer";

const onlineState = () => {
  const state = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });
  state.players[PlayerSymbol.O].isActive = true;
  return state;
};

describe("applyAuthorizedMove", () => {
  it("allows the host to play X on the host turn", () => {
    const next = applyAuthorizedMove(onlineState(), 0, PlayerSymbol.X);
    expect(next?.board[0]).toBe(PlayerSymbol.X);
  });

  it("rejects a guest trying to play the host turn", () => {
    expect(applyAuthorizedMove(onlineState(), 0, PlayerSymbol.O)).toBeNull();
  });

  it("rejects malformed move indices", () => {
    expect(applyAuthorizedMove(onlineState(), Number.NaN, PlayerSymbol.X)).toBeNull();
    expect(applyAuthorizedMove(onlineState(), 1.5, PlayerSymbol.X)).toBeNull();
  });
});

describe("isPeerMessage", () => {
  it("accepts supported protocol messages", () => {
    expect(isPeerMessage({ type: "move", index: 4 })).toBe(true);
    expect(isPeerMessage({ type: "leave" })).toBe(true);
  });

  it("rejects unknown or malformed protocol messages", () => {
    expect(isPeerMessage({ type: "move", index: "4" })).toBe(false);
    expect(isPeerMessage({ type: "admin", command: "win" })).toBe(false);
    expect(isPeerMessage(null)).toBe(false);
  });
});
