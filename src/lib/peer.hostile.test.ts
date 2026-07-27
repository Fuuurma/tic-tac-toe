import { describe, expect, it } from "vitest";
import {
  AI_Difficulty,
  AVAILABLE_COLORS,
  Color,
  GAME_RULES,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  TURN_DURATION_MS,
  WINNING_COMBINATIONS,
} from "@/game/constants";
import {
  createInitialGameState,
  freshGameState,
  makeMove,
} from "@/game/logic";
import {
  applyAuthorizedMove,
  isPeerMessage,
  PEER_MAX_BOARD_INDEX,
  PEER_MAX_NAME_LENGTH,
  PEER_MAX_TURN_MS,
} from "@/lib/peer";

const baselineState = () => {
  const state = createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });
  state.players[PlayerSymbol.O].isActive = true;
  state.turnTimeRemaining = TURN_DURATION_MS;
  return state;
};

const validMessage = () => ({
  type: "gameUpdate",
  gameState: baselineState(),
});

describe("applyAuthorizedMove hostile bounds", () => {
  it("rejects negative move indices", () => {
    expect(applyAuthorizedMove(baselineState(), -1, PlayerSymbol.X)).toBeNull();
  });

  it("rejects out-of-range move indices", () => {
    expect(
      applyAuthorizedMove(baselineState(), PEER_MAX_BOARD_INDEX + 1, PlayerSymbol.X),
    ).toBeNull();
    expect(
      applyAuthorizedMove(baselineState(), Number.MAX_SAFE_INTEGER, PlayerSymbol.X),
    ).toBeNull();
    expect(
      applyAuthorizedMove(baselineState(), Number.MIN_SAFE_INTEGER, PlayerSymbol.X),
    ).toBeNull();
  });

  it("accepts the upper boundary index", () => {
    const state = baselineState();
    expect(applyAuthorizedMove(state, PEER_MAX_BOARD_INDEX, PlayerSymbol.X)).not.toBeNull();
  });
});

describe("isPeerMessage hostile frames", () => {
  it("accepts a well-formed game-update frame", () => {
    expect(isPeerMessage(validMessage())).toBe(true);
  });

  it("rejects join frames with strings that exceed safe bounds", () => {
    const hugeName = "X".repeat(PEER_MAX_NAME_LENGTH + 1);
    expect(
      isPeerMessage({ type: "join", displayName: hugeName, guestId: "guest:1" }),
    ).toBe(false);

    const hugeGuestId = "g".repeat(65);
    expect(
      isPeerMessage({ type: "join", displayName: "Alice", guestId: hugeGuestId }),
    ).toBe(false);

    expect(
      isPeerMessage({ type: "join", displayName: "", guestId: "guest:1" }),
    ).toBe(false);

    expect(
      isPeerMessage({ type: "join", displayName: "Alice", guestId: "" }),
    ).toBe(false);
  });

  it("accepts join frames with safe string bounds", () => {
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice",
        guestId: "guest:1234",
      }),
    ).toBe(true);
  });

  it("rejects join frames that spoof invalid preferred colors", () => {
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice",
        guestId: "guest:1",
        preferredColor: "transparent",
      }),
    ).toBe(false);
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice",
        guestId: "guest:1",
        preferredColor: null,
      }),
    ).toBe(false);
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice",
        guestId: "guest:1",
        preferredColor: 42,
      }),
    ).toBe(false);
  });

  it("accepts join frames that omit preferredColor and any in-enum color", () => {
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice",
        guestId: "guest:1",
      }),
    ).toBe(true);
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice",
        guestId: "guest:1",
        preferredColor: Color.BLUE,
      }),
    ).toBe(true);
  });

  it("rejects move frames that exceed the board range or are non-integers", () => {
    expect(isPeerMessage({ type: "move", index: -1 })).toBe(false);
    expect(
      isPeerMessage({ type: "move", index: PEER_MAX_BOARD_INDEX + 1 }),
    ).toBe(false);
    expect(isPeerMessage({ type: "move", index: 1.5 })).toBe(false);
    expect(isPeerMessage({ type: "move", index: "4" })).toBe(false);
    expect(isPeerMessage({ type: "move", index: Number.NaN })).toBe(false);
    expect(isPeerMessage({ type: "move", index: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
  });

  it("accepts move indices at both ends of the valid range", () => {
    expect(isPeerMessage({ type: "move", index: 0 })).toBe(true);
    expect(isPeerMessage({ type: "move", index: PEER_MAX_BOARD_INDEX })).toBe(true);
  });

  it("rejects rematch requesters that are not in the PlayerSymbol enum", () => {
    expect(isPeerMessage({ type: "rematchRequested", requesterSymbol: "Z" })).toBe(
      false,
    );
    expect(isPeerMessage({ type: "rematchRequested", requesterSymbol: null })).toBe(
      false,
    );
  });

  it("rejects unknown protocol types", () => {
    expect(isPeerMessage({ type: "admin", command: "win" })).toBe(false);
    expect(isPeerMessage({ type: "peer-left", reason: "expired" })).toBe(false);
    expect(isPeerMessage({ type: "welcome", role: "host" })).toBe(false);
  });

  it("rejects error frames with non-string messages", () => {
    expect(isPeerMessage({ type: "error", message: 42 })).toBe(false);
    expect(isPeerMessage({ type: "error" })).toBe(false);
  });
});

describe("isPeerMessage hostile game-state frames", () => {
  it("rejects gameState with an oversized board", () => {
    const frame = validMessage();
    frame.gameState.board = new Array(20).fill(null);
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with non-cell entries", () => {
    const frame = validMessage();
    (frame.gameState as unknown as { board: unknown[] }).board = Array(9).fill("Z");
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState that declares an unknown game mode", () => {
    const frame = validMessage();
    (frame.gameState as unknown as { gameMode: unknown }).gameMode = "REALTIME_PvP";
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState that uses an unknown AI difficulty", () => {
    const frame = validMessage();
    (frame.gameState as unknown as { aiDifficulty: unknown }).aiDifficulty = "INSANE";
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState that uses an unknown PlayerType", () => {
    const frame = validMessage();
    (
      frame.gameState.players[PlayerSymbol.X] as unknown as { type: unknown }
    ).type = "BOT";
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState that uses an unknown color", () => {
    const frame = validMessage();
    (
      frame.gameState.players[PlayerSymbol.X] as unknown as { color: unknown }
    ).color = "rainbow";
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a synthetic winningCombination", () => {
    const frame = validMessage();
    frame.gameState.winningCombination = [0, 1, 2] as const;
    // The combination itself is valid as a line, so test a fake one:
    frame.gameState.winningCombination = [0, 1, 3] as never;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a winningCombination that is not in the canonical set", () => {
    const frame = validMessage();
    // A permutation not matching any winning row (use indices {0,1,4})
    frame.gameState.winningCombination = [0, 1, 4] as never;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a winningCombination that duplicates illegal cells", () => {
    const frame = validMessage();
    frame.gameState.winningCombination = [3, 3, 3] as never;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("accepts a winningCombination that matches one of the canonical rows", () => {
    const frame = validMessage();
    frame.gameState.winner = PlayerSymbol.X;
    frame.gameState.winningCombination = [...WINNING_COMBINATIONS[0]] as never;
    expect(isPeerMessage(frame)).toBe(true);
  });

  it("rejects gameState with lastMoveIndex out of range", () => {
    const frame = validMessage();
    (frame.gameState as unknown as { lastMoveIndex: unknown }).lastMoveIndex = 99;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with lastMoveIndex that is not an integer", () => {
    const frame = validMessage();
    (frame.gameState as unknown as { lastMoveIndex: unknown }).lastMoveIndex = 0.5;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a turnTimeRemaining value that exceeds the budget", () => {
    const frame = validMessage();
    frame.gameState.turnTimeRemaining = PEER_MAX_TURN_MS + 1000;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a negative turnTimeRemaining", () => {
    const frame = validMessage();
    frame.gameState.turnTimeRemaining = -1;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a non-numeric turnTimeRemaining", () => {
    const frame = validMessage();
    (frame.gameState as unknown as { turnTimeRemaining: unknown }).turnTimeRemaining =
      "1000";
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a maxMoves outside the configured rule range", () => {
    const frame = validMessage();
    frame.gameState.maxMoves = GAME_RULES.MAX_MOVES_PER_PLAYER + 1;
    expect(isPeerMessage(frame)).toBe(false);
    frame.gameState.maxMoves = 0;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with a negative moveCount", () => {
    const frame = validMessage();
    frame.gameState.moveCount = -1;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState with non-integer moveCount", () => {
    const frame = validMessage();
    frame.gameState.moveCount = 1.5;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState where moves.X contains out-of-range indices", () => {
    const frame = validMessage();
    frame.gameState.moves[PlayerSymbol.X] = [0, 99, 2] as never;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState where moves.X exceeds the maxMoves cap", () => {
    const frame = validMessage();
    frame.gameState.moves[PlayerSymbol.X] = [0, 1, 2, 3] as never;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects gameState where nextToRemove points off the board", () => {
    const frame = validMessage();
    frame.gameState.nextToRemove[PlayerSymbol.X] = -2;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("accepts a fully well-formed state built from the freshGameState + legal move", () => {
    const next = makeMove(freshGameState(), 0);
    if (!next) throw new Error("seed move must be legal");
    const state = {
      ...baselineState(),
      board: next.board,
      moveCount: next.moveCount,
    };
    state.gameStatus = GameStatus.ACTIVE;
    state.gameMode = GameModes.ONLINE;
    state.players[PlayerSymbol.X].type = PlayerTypes.HUMAN;
    state.players[PlayerSymbol.O].type = PlayerTypes.HUMAN;
    expect(isPeerMessage({ type: "gameUpdate", gameState: state })).toBe(true);
  });

  it("rejects a totally hostile game-state envelope", () => {
    const frame = {
      type: "gameUpdate",
      gameState: {
        board: [],
        currentPlayer: 1,
        winner: "Z",
        winningCombination: [99, 99, 99],
        lastMoveIndex: -5,
        players: { X: {}, O: {} },
        moves: { X: [], O: [] },
        nextToRemove: { X: "nope", O: 5 },
        maxMoves: 999,
        moveCount: -3,
        gameStatus: "WRONG",
        gameMode: "BEZERK",
        aiDifficulty: "INSANE",
        turnTimeRemaining: Number.POSITIVE_INFINITY,
      },
    };
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects a joined frame with a non-enum color or symbol", () => {
    const frame = {
      type: "joined",
      symbol: "Z",
      color: "rainbow",
      gameState: baselineState(),
    };
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("accepts a joined frame with a canonical PlayerSymbol and Color", () => {
    expect(
      isPeerMessage({
        type: "joined",
        symbol: PlayerSymbol.X,
        color: Color.BLUE,
        gameState: baselineState(),
      }),
    ).toBe(true);
  });

  it("rejects a freshly-tampered player config", () => {
    const state = baselineState();
    state.players[PlayerSymbol.X].color = "rainbow" as never;
    expect(isPeerMessage({ type: "gameUpdate", gameState: state })).toBe(false);
  });

  it("rejects an oversized moves.X entry that claims more than maxMoves", () => {
    const state = baselineState();
    state.moves[PlayerSymbol.X] = Array(GAME_RULES.MAX_MOVES_PER_PLAYER + 1).fill(
      0,
    ) as never;
    expect(isPeerMessage({ type: "gameUpdate", gameState: state })).toBe(false);
  });

  it("rejects winner values outside the PlayerSymbol enum", () => {
    const state = baselineState();
    state.winner = "Z" as never;
    expect(isPeerMessage({ type: "gameUpdate", gameState: state })).toBe(false);
  });

  it("uses the canonical colors set when validating wire colors", () => {
    expect(AVAILABLE_COLORS.includes("rainbow" as unknown as Color)).toBe(false);
    expect(AVAILABLE_COLORS.includes(Color.BLUE)).toBe(true);
  });

  it("rejects an AI difficulty outside the wired enum", () => {
    expect(typeof AI_Difficulty.EASY).toBe("string");
    expect(
      isPeerMessage({
        type: "gameUpdate",
        gameState: { ...baselineState(), aiDifficulty: "GIGA" },
      }),
    ).toBe(false);
  });
});

describe("isPeerMessage joined payload", () => {
  it("rejects joined when the nested gameState is malformed", () => {
    expect(
      isPeerMessage({
        type: "joined",
        symbol: PlayerSymbol.O,
        color: Color.RED,
        gameState: { ...baselineState(), board: Array(5).fill(null) },
      }),
    ).toBe(false);
  });
});
