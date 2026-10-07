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
  makeMove,
} from "@/game/logic";
import {
  applyAuthorizedMove,
  applyForfeitIfActive,
  isPeerMessage,
  PEER_MAX_BOARD_INDEX,
  PEER_MAX_MOVE_COUNT,
  PEER_MAX_NAME_LENGTH,
  PEER_MAX_TURN_DEADLINE,
  PEER_MAX_ERROR_LENGTH,
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

  // F469: the producers now truncate at code-point boundaries, but the wire
  // check is the trust boundary — a stale or hostile peer can still send a
  // name ending in a lone surrogate, which renders as U+FFFD.
  it("rejects display names containing lone surrogates (F469)", () => {
    const splitPair = `${"a".repeat(19)}\uD83E`;
    expect(
      isPeerMessage({
        type: "join",
        displayName: splitPair,
        guestId: "guest:1",
      }),
    ).toBe(false);
    expect(
      isPeerMessage({
        type: "join",
        displayName: "ab\uDC00",
        guestId: "guest:1",
      }),
    ).toBe(false);
    // The mirror check: a well-formed pair in the same field must pass.
    expect(
      isPeerMessage({
        type: "join",
        displayName: "Alice\u{1F600}",
        guestId: "guest:1",
      }),
    ).toBe(true);
  });

  it("rejects gameState usernames containing lone surrogates (F469)", () => {
    const frame = validMessage();
    (
      frame.gameState.players[PlayerSymbol.X] as unknown as { username: string }
    ).username = `Host\uD83E`;
    expect(isPeerMessage(frame)).toBe(false);
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

  it("rejects error frames that exceed the wire length cap", () => {
    expect(
      isPeerMessage({ type: "error", message: "x".repeat(PEER_MAX_ERROR_LENGTH + 1) }),
    ).toBe(false);
    expect(
      isPeerMessage({ type: "error", message: "x".repeat(PEER_MAX_ERROR_LENGTH) }),
    ).toBe(true);
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
    // F192: the claimed line must exist on the board — place the win.
    for (const i of WINNING_COMBINATIONS[0]) {
      frame.gameState.board[i] = PlayerSymbol.X;
    }
    expect(isPeerMessage(frame)).toBe(true);
  });

  it("rejects a winner + winningCombination the board does not contain (F192)", () => {
    const frame = validMessage();
    // All-O board but a claimed X win — individually valid fields,
    // collectively impossible.
    frame.gameState.board = Array(9).fill(PlayerSymbol.O) as never;
    frame.gameState.winner = PlayerSymbol.X;
    frame.gameState.winningCombination = [...WINNING_COMBINATIONS[0]] as never;
    expect(isPeerMessage(frame)).toBe(false);
  });

  it("rejects a winner with a null winningCombination on every state frame (F404)", () => {
    // The F192 cross-check used to fire only when BOTH fields were set, so
    // winner:X + winningCombination:null minted a phantom win — reachable
    // through the state_snapshot branch added for reconnect sync.
    const state = {
      ...baselineState(),
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
      winningCombination: null,
    };
    expect(isPeerMessage({ type: "state_snapshot", gameState: state })).toBe(
      false,
    );
    expect(isPeerMessage({ type: "gameUpdate", gameState: state })).toBe(false);
    expect(
      isPeerMessage({
        type: "joined",
        symbol: PlayerSymbol.O,
        color: Color.RED,
        gameState: state,
      }),
    ).toBe(false);
    expect(
      isPeerMessage({
        type: "gameStart",
        symbol: PlayerSymbol.O,
        gameState: state,
      }),
    ).toBe(false);
  });

  it("rejects a winningCombination with a null winner — the mirror F404 case", () => {
    // makeMove always writes the pair together, so a claimed line with
    // no winner is as impossible as a winner with no line. Build a state
    // where the board DOES hold the line — only the missing winner is
    // invalid, proving the mirror check fires rather than F192.
    const state = {
      ...baselineState(),
      winner: null,
      winningCombination: [...WINNING_COMBINATIONS[0]],
    };
    for (const i of WINNING_COMBINATIONS[0]) {
      state.board[i] = PlayerSymbol.X;
    }
    expect(isPeerMessage({ type: "state_snapshot", gameState: state })).toBe(
      false,
    );
    expect(isPeerMessage({ type: "gameUpdate", gameState: state })).toBe(false);
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

  it("accepts a safe integer turn deadline", () => {
    const frame = validMessage();
    frame.gameState.turnDeadlineAt = Date.now() + TURN_DURATION_MS;
    expect(isPeerMessage(frame)).toBe(true);
  });

  it("rejects malformed turn deadlines", () => {
    const overMax = validMessage();
    overMax.gameState.turnDeadlineAt = PEER_MAX_TURN_DEADLINE + 1;
    expect(isPeerMessage(overMax)).toBe(false);

    const fractional = validMessage();
    fractional.gameState.turnDeadlineAt = Date.now() + 0.5;
    expect(isPeerMessage(fractional)).toBe(false);
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

  // F347: moveCount was the only wire scalar with no upper bound — every
  // sibling (maxMoves, moves arrays, timer fields) is capped. The ceiling
  // is an absurdity bound, far past any game a live room could reach.
  it("rejects gameState with moveCount above the wire ceiling (F347)", () => {
    const frame = validMessage();
    frame.gameState.moveCount = PEER_MAX_MOVE_COUNT + 1;
    expect(isPeerMessage(frame)).toBe(false);
    frame.gameState.moveCount = PEER_MAX_MOVE_COUNT;
    expect(isPeerMessage(frame)).toBe(true);
  });

  // F347: turnNotice is the one wire-reachable GameState string field that
  // had no bound at all — a hostile gameUpdate could store an arbitrarily
  // long string into guest state on every frame. It is UX copy like the
  // error-message field, so it shares that bound.
  it("rejects gameState with an oversized or malformed turnNotice (F347)", () => {
    const frame = validMessage();
    (
      frame.gameState as unknown as { turnNotice: unknown }
    ).turnNotice = "x".repeat(PEER_MAX_ERROR_LENGTH + 1);
    expect(isPeerMessage(frame)).toBe(false);

    (frame.gameState as unknown as { turnNotice: unknown }).turnNotice = 42;
    expect(isPeerMessage(frame)).toBe(false);

    // A lone surrogate passes the length bound but renders as U+FFFD.
    (frame.gameState as unknown as { turnNotice: unknown }).turnNotice =
      "Ada ran out of time\uD83E";
    expect(isPeerMessage(frame)).toBe(false);

    // The real producer's payload and the cleared (absent) form both pass.
    (frame.gameState as unknown as { turnNotice: unknown }).turnNotice =
      "Ada ran out of time";
    expect(isPeerMessage(frame)).toBe(true);
    delete (frame.gameState as unknown as { turnNotice?: unknown }).turnNotice;
    expect(isPeerMessage(frame)).toBe(true);
  });

  // F471: isPlayerConfig validated that p.symbol was a PlayerSymbol but not
  // that it matched the map key, so players.X.symbol === "O" passed — a
  // state the engine cannot produce (freshGameState always writes the key
  // into symbol). Same impossible-state family as F192/F404.
  it("rejects gameState whose player symbol disagrees with its map key (F471)", () => {
    const frame = validMessage();
    // Swap the two player configs: every field stays individually valid,
    // only the key↔symbol pairing becomes impossible.
    const players = frame.gameState.players;
    [players[PlayerSymbol.X], players[PlayerSymbol.O]] = [
      players[PlayerSymbol.O],
      players[PlayerSymbol.X],
    ];
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
    const next = makeMove(baselineState(), 0);
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

// A forfeit ends a game without a completed line, so `winner` is set while
// `winningCombination` stays null. That is precisely the shape F404 rejects
// as a phantom win — so `applyForfeitIfActive` used to mint a state that the
// receiving peer's own validator dropped. The flag is what separates the
// legitimate forfeit from a peer claiming a win it never made; without it,
// every resync of a finished game (a rejoining peer's `joined`, a sync
// snapshot, a rejected move's correction) was silently discarded and the
// joiner waited forever on a frame that could never validate.
describe("forfeit state survives the wire validator", () => {
  const forfeited = () =>
    applyForfeitIfActive(baselineState(), PlayerSymbol.X);

  it("marks the forfeit and leaves the line empty", () => {
    const state = forfeited();
    expect(state.winner).toBe(PlayerSymbol.X);
    expect(state.gameStatus).toBe(GameStatus.COMPLETED);
    expect(state.winningCombination).toBeNull();
    expect(state.forfeited).toBe(true);
  });

  it("validates on every frame type that can carry it", () => {
    const gameState = forfeited();
    expect(isPeerMessage({ type: "gameUpdate", gameState })).toBe(true);
    expect(isPeerMessage({ type: "state_snapshot", gameState })).toBe(true);
    expect(
      isPeerMessage({
        type: "joined",
        symbol: PlayerSymbol.O,
        color: Color.RED,
        gameState,
      }),
    ).toBe(true);
    expect(
      isPeerMessage({
        type: "gameStart",
        symbol: PlayerSymbol.O,
        gameState,
      }),
    ).toBe(true);
  });

  it("still rejects an UNFLAGGED winner with no line — the F404 guard is intact", () => {
    const { forfeited: _dropped, ...unflagged } = forfeited();
    expect(
      isPeerMessage({ type: "gameUpdate", gameState: unflagged }),
    ).toBe(false);
  });

  it("rejects a stray forfeit flag that no state this code produces can carry", () => {
    // A flag on a live game, or on a game with no winner, is not a shape any
    // caller can build — reject rather than let it ride through to the UI.
    expect(
      isPeerMessage({
        type: "gameUpdate",
        gameState: { ...baselineState(), forfeited: true },
      }),
    ).toBe(false);
    expect(
      isPeerMessage({
        type: "gameUpdate",
        gameState: {
          ...forfeited(),
          winner: null,
        },
      }),
    ).toBe(false);
  });
});

// `pause` is a host→guest session signal: the host froze its clock. It must
// not carry game state (the host still broadcasts that separately) and must
// not be craftable into anything else.
describe("isPeerMessage pause frame", () => {
  it("accepts a well-formed pause signal both ways", () => {
    expect(isPeerMessage({ type: "pause", paused: true })).toBe(true);
    expect(isPeerMessage({ type: "pause", paused: false })).toBe(true);
  });

  it("rejects a non-boolean pause flag", () => {
    expect(isPeerMessage({ type: "pause", paused: "yes" })).toBe(false);
    expect(isPeerMessage({ type: "pause", paused: 1 })).toBe(false);
    expect(isPeerMessage({ type: "pause" })).toBe(false);
  });

  it("ignores an extra gameState rather than trusting it", () => {
    // A guest must not be able to assert authority over the game through the
    // session channel. The validator is a tolerant reader — it checks the
    // fields it knows and ignores the rest — so a smuggled gameState is
    // simply not read by the pause branch. State only ever takes effect on
    // the state-bearing frames, which validate `winner` against the board.
    expect(
      isPeerMessage({
        type: "pause",
        paused: true,
        gameState: { ...baselineState(), winner: PlayerSymbol.X },
      }),
    ).toBe(true);

    // The state-bearing frames still refuse that same payload.
    const smuggled = { ...baselineState(), winner: PlayerSymbol.X };
    expect(isPeerMessage({ type: "gameUpdate", gameState: smuggled })).toBe(false);
  });
});
