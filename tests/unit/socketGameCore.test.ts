import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  Color,
  GameRoom,
  GameStatus,
  PlayerSymbol,
  getWinnerResult,
  normalizeLoginPayload,
} = require("../../socketGameCore");

describe("socketGameCore", () => {
  it("normalizes object login payloads with identity metadata", () => {
    expect(
      normalizeLoginPayload({
        displayName: "  <Ada>   Lovelace  ",
        guestId: "guest:ada-1234",
        profileId: "profiles:abc_123",
        userId: "user:abc-123",
        color: Color.GREEN,
      })
    ).toEqual({
      displayName: "Ada Lovelace",
      guestId: "guest:ada-1234",
      profileId: "profiles:abc_123",
      userId: "user:abc-123",
      identityKind: "account",
      color: Color.GREEN,
    });
  });

  it("preserves player identity metadata when resetting a room", () => {
    const room = new GameRoom("room-test");
    room.addPlayer(
      "socket-x",
      {
        displayName: "Guest Alpha",
        identityKind: "guest",
        guestId: "guest:alpha-1234",
      },
      Color.BLUE,
      PlayerSymbol.X
    );
    room.addPlayer(
      "socket-o",
      {
        displayName: "Account Beta",
        identityKind: "account",
        guestId: "guest:beta-1234",
        profileId: "profiles:beta",
        userId: "user:beta",
      },
      Color.PURPLE,
      PlayerSymbol.O
    );

    room.gameState.board[0] = PlayerSymbol.X;
    room.gameState.moveCount = 1;
    room.resetGame(GameStatus.WAITING);

    expect(room.gameState.board.every((cell: string | null) => cell === null)).toBe(true);
    expect(room.gameState.moveCount).toBe(0);
    expect(room.gameState.gameStatus).toBe(GameStatus.WAITING);
    expect(room.gameState.players.X).toMatchObject({
      username: "Guest Alpha",
      color: Color.BLUE,
      identityKind: "guest",
      guestId: "guest:alpha-1234",
      isActive: true,
    });
    expect(room.gameState.players.O).toMatchObject({
      username: "Account Beta",
      color: Color.PURPLE,
      identityKind: "account",
      guestId: "guest:beta-1234",
      profileId: "profiles:beta",
      userId: "user:beta",
      isActive: true,
    });
  });

  it("does not fabricate a socket winner for a full board without a line", () => {
    const board = [
      PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.X,
      PlayerSymbol.X, PlayerSymbol.O, PlayerSymbol.O,
      PlayerSymbol.O, PlayerSymbol.X, PlayerSymbol.X,
    ];

    expect(getWinnerResult(board, PlayerSymbol.O)).toEqual({
      winner: null,
      winningCombination: null,
    });
  });
});
