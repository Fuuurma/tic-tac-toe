import { describe, expect, it } from "vitest";
import { Color, GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import {
  applyAuthorizedMove,
  applyHostGuestJoin,
  applyOptimisticMove,
  generateRoomId,
  isPeerMessage,
  PEER_MAX_ERROR_LENGTH,
  peerLeftUserMessage,
} from "@/lib/peer";

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

describe("applyOptimisticMove", () => {
  it("lets the online guest see a legal move before the relay round trip", () => {
    const afterHostMove = applyAuthorizedMove(onlineState(), 0, PlayerSymbol.X)!;
    const next = applyOptimisticMove(afterHostMove, 4, PlayerSymbol.O);

    expect(next?.board[4]).toBe(PlayerSymbol.O);
    expect(next?.currentPlayer).toBe(PlayerSymbol.X);
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

  it("accepts rematchRequested with either PlayerSymbol as the requester", () => {
    expect(
      isPeerMessage({ type: "rematchRequested", requesterSymbol: PlayerSymbol.X }),
    ).toBe(true);
    expect(
      isPeerMessage({ type: "rematchRequested", requesterSymbol: PlayerSymbol.O }),
    ).toBe(true);
  });

  it("accepts the host's 'invalid move' error frame used to roll back a guest", () => {
    expect(isPeerMessage({ type: "error", message: "Invalid move" })).toBe(true);
    // Anything else the relay sends still validates through isPeerMessage.
    expect(isPeerMessage({ type: "error", message: "Server overloaded" })).toBe(true);
  });

  it("rejects oversized error messages", () => {
    expect(
      isPeerMessage({ type: "error", message: "x".repeat(PEER_MAX_ERROR_LENGTH + 1) }),
    ).toBe(false);
  });
});

describe("generateRoomId", () => {
  it("returns a room id long enough that guessing is not trivial", () => {
    const roomId = generateRoomId();
    expect(roomId.length).toBeGreaterThanOrEqual(32);
    expect(roomId.length).toBeLessThanOrEqual(64);
  });
});

describe("applyHostGuestJoin", () => {
  const waitingHostState = () => {
    const state = createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Host",
      playerOName: "Waiting for opponent",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    state.gameStatus = GameStatus.WAITING;
    return state;
  };

  it("starts the match when the host is still waiting", () => {
    const result = applyHostGuestJoin(waitingHostState(), PlayerSymbol.X, {
      displayName: "Guest",
      preferredColor: Color.RED,
    });
    expect(result.kind).toBe("accepted");
    expect(result.gameState.gameStatus).toBe(GameStatus.ACTIVE);
    expect(result.gameState.players[PlayerSymbol.O].username).toBe("Guest");
    expect(result.guestSymbol).toBe(PlayerSymbol.O);
  });

  it("resyncs without resetting an in-progress board", () => {
    const first = applyHostGuestJoin(waitingHostState(), PlayerSymbol.X, {
      displayName: "Guest",
      preferredColor: Color.RED,
    });
    const afterMove = applyAuthorizedMove(first.gameState, 0, PlayerSymbol.X);
    expect(afterMove).not.toBeNull();
    const result = applyHostGuestJoin(afterMove!, PlayerSymbol.X, {
      displayName: "Intruder",
      preferredColor: Color.GREEN,
    });
    expect(result.kind).toBe("resync");
    expect(result.gameState.board[0]).toBe(PlayerSymbol.X);
    expect(result.gameState.players[PlayerSymbol.O].username).toBe("Guest");
  });
});

describe("peerLeftUserMessage", () => {
  it("keeps reconnect copy for a transient disconnect", () => {
    expect(peerLeftUserMessage("host", "disconnect")).toBe(
      "Opponent disconnected. Reconnecting…",
    );
    expect(peerLeftUserMessage("guest", "disconnect")).toBe(
      "Host disconnected. Reconnecting…",
    );
  });

  it("distinguishes a voluntary close from a reconnect timeout", () => {
    expect(peerLeftUserMessage("host", "closed")).toBe("Opponent left the room");
    expect(peerLeftUserMessage("host", "expired")).toBe(
      "Opponent did not reconnect in time",
    );
    expect(peerLeftUserMessage("guest", "closed")).toBe("Host left the room");
    expect(peerLeftUserMessage("guest", "expired")).toBe("Host did not reconnect in time");
  });
});
