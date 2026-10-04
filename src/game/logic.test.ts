import { describe, expect, it } from "vitest";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PLAYER_CONFIG,
  oppositeSymbol,
  oppositeColor,
} from "@/game/constants";
import {
  checkWinner,
  createInitialGameState,
  freshGameState,
  getNextPlayerSymbol,
  getValidMoves,
  isValidMove,
  makeMove,
  type GameState,
} from "@/game/logic";

// Tests that exercise moves must start ACTIVE — freshGameState() is the
// WAITING lobby state and isValidMove now (correctly) rejects non-active games.
// Annotated GameState (not the narrow ACTIVE literal) so makeMove's broad
// return type stays assignable across chained moves incl. terminal states.
const activeState = (): GameState => ({ ...freshGameState(), gameStatus: GameStatus.ACTIVE });

describe("freshGameState", () => {
  it("returns a clean state with an empty 3x3 board", () => {
    const state = freshGameState();
    expect(state.board).toHaveLength(9);
    expect(state.board.every((c) => c === null)).toBe(true);
    expect(state.winner).toBeNull();
    expect(state.currentPlayer).toBe(PlayerSymbol.X);
    expect(state.gameStatus).toBe("WAITING");
  });
});

describe("createInitialGameState", () => {
  it("initializes players and sets the game active", () => {
    const state = createInitialGameState({
      gameMode: GameModes.VS_COMPUTER,
      playerXName: "Alice",
      playerOName: "Bot",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    expect(state.players[PlayerSymbol.X].username).toBe("Alice");
    expect(state.players[PlayerSymbol.X].color).toBe(Color.BLUE);
    expect(state.players[PlayerSymbol.O].type).toBe("COMPUTER");
    expect(state.gameStatus).toBe("ACTIVE");
    expect(state.gameMode).toBe(GameModes.VS_COMPUTER);
  });

  it("supports the human choosing O against the computer", () => {
    const state = createInitialGameState({
      gameMode: GameModes.VS_COMPUTER,
      playerXName: "Bot",
      playerOName: "Alice",
      playerColor: Color.GREEN,
      opponentColor: Color.PURPLE,
      humanSymbol: PlayerSymbol.O,
    });

    expect(state.currentPlayer).toBe(PlayerSymbol.X);
    expect(state.players[PlayerSymbol.X]).toMatchObject({
      username: "Bot",
      color: Color.PURPLE,
      type: "COMPUTER",
    });
    expect(state.players[PlayerSymbol.O]).toMatchObject({
      username: "Alice",
      color: Color.GREEN,
      type: "HUMAN",
    });
  });
});

describe("getValidMoves", () => {
  it("returns all empty indices for an empty board", () => {
    const state = freshGameState();
    expect(getValidMoves(state.board)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("excludes occupied cells", () => {
    const state = makeMove(activeState(), 4)!;
    const valid = getValidMoves(state.board);
    expect(valid).not.toContain(4);
    expect(valid).toHaveLength(8);
  });
});

describe("isValidMove", () => {
  it("rejects moves after the game has ended", () => {
    const state = activeState();
    let s = makeMove(state, 0)!;
    s = makeMove(s, 3)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 2)!;
    expect(s.winner).toBe(PlayerSymbol.X);
    expect(isValidMove(s, 5, PlayerSymbol.O)).toBe(false);
  });

  it("rejects moves on occupied cells", () => {
    const state = makeMove(activeState(), 4)!;
    expect(isValidMove(state, 4, PlayerSymbol.O)).toBe(false);
  });

  it("rejects non-integer indices — a float must not write an out-of-band cell (F218)", () => {
    const state = activeState();
    // X is currentPlayer in an active fresh game.
    expect(isValidMove(state, 1.5, PlayerSymbol.X)).toBe(false);
    expect(isValidMove(state, 0.5, PlayerSymbol.X)).toBe(false);
    expect(isValidMove(state, Number.NaN, PlayerSymbol.X)).toBe(false);
    // makeMove must not smuggle the float into history or the board.
    const moved = makeMove(state, 1.5);
    expect(moved).toBeNull();
  });

  it("rejects moves by the wrong player", () => {
    const state = activeState();
    expect(isValidMove(state, 0, PlayerSymbol.O)).toBe(false);
  });

  it("rejects moves while the game is WAITING — a peer packet must not move a not-yet-active game", () => {
    const state = { ...freshGameState(), gameStatus: GameStatus.WAITING };
    expect(state.winner).toBeNull();
    expect(isValidMove(state, 0, PlayerSymbol.X)).toBe(false);
  });
});

describe("checkWinner", () => {
  it("detects a row win for X", () => {
    let s = activeState();
    s = makeMove(s, 0)!;
    s = makeMove(s, 3)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 2)!;
    const { winner, combination } = checkWinner(s.board);
    expect(winner).toBe(PlayerSymbol.X);
    expect(combination).toEqual([0, 1, 2]);
  });

  it("detects a middle-row win for O", () => {
    let s = activeState();
    s = makeMove(s, 0)!;
    s = makeMove(s, 3)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 6)!;
    s = makeMove(s, 5)!;
    const { winner, combination } = checkWinner(s.board);
    expect(winner).toBe(PlayerSymbol.O);
    expect(combination).toEqual([3, 4, 5]);
  });

  it("detects a diagonal win", () => {
    let s = activeState();
    s = makeMove(s, 0)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 2)!;
    s = makeMove(s, 8)!;
    const { winner, combination } = checkWinner(s.board);
    expect(winner).toBe(PlayerSymbol.X);
    expect(combination).toEqual([0, 4, 8]);
  });

  it("returns null winner for an unfinished board", () => {
    const s = makeMove(activeState(), 0)!;
    expect(checkWinner(s.board).winner).toBeNull();
  });
});

describe("makeMove (3-piece cap rule)", () => {
  it("marks the oldest piece once a player has three pieces", () => {
    let s = createInitialGameState({
      gameMode: GameModes.VS_FRIEND,
      playerXName: "A",
      playerOName: "B",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    // Six moves leave each player at the three-piece cap with no winner.
    s = makeMove(s, 0)!;
    s = makeMove(s, 3)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 5)!;
    s = makeMove(s, 2)!;
    expect(s.winner).toBeNull();
    expect(s.nextToRemove[PlayerSymbol.X]).toBe(0);
    expect(s.nextToRemove[PlayerSymbol.O]).toBe(3);
    expect(s.moves[PlayerSymbol.X]).toEqual([0, 4, 5]);
    expect(s.moves[PlayerSymbol.O]).toEqual([3, 1, 2]);
  });

  it("removes the oldest piece when a fourth piece is placed", () => {
    let s = createInitialGameState({
      gameMode: GameModes.VS_FRIEND,
      playerXName: "A",
      playerOName: "B",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    for (const move of [0, 3, 4, 1, 5, 2]) s = makeMove(s, move)!;
    s = makeMove(s, 6)!;

    expect(s.board[0]).toBeNull();
    expect(s.board[6]).toBe(PlayerSymbol.X);
    expect(s.moves[PlayerSymbol.X]).toEqual([4, 5, 6]);
    expect(s.nextToRemove[PlayerSymbol.X]).toBe(4);
    expect(s.winner).toBeNull();
    expect(s.gameStatus).toBe("ACTIVE");
  });

  // F401 asked for a draw counter in the stats record, on the premise that
  // "every drawn game vanishes". The premise does not hold for this variant:
  // a player's fourth mark erases their oldest, so each side is capped at
  // MAX_MOVES_PER_PLAYER and the board can never fill. This pins the reason,
  // so the premise is not re-derived from memory later.
  it("can never reach a full board, so a draw is unreachable (F401)", () => {
    let s = createInitialGameState({
      gameMode: GameModes.VS_FRIEND,
      playerXName: "A",
      playerOName: "B",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });

    // 40 alternating moves across a deliberately winning-free pattern. Any
    // move that ends the game is skipped, so this plays as long as the rules
    // allow rather than stopping at the first win.
    const candidates = [0, 3, 4, 1, 5, 2, 6, 7, 8];
    let cursor = 0;
    for (let i = 0; i < 40; i += 1) {
      const before = s;
      const next = makeMove(s, candidates[cursor % candidates.length]!);
      cursor += 1;
      if (next === null) {
        // Either the game ended (a win) or the cell was rejected. Either way
        // the board at this point must still be short of full.
        s = before;
        break;
      }
      s = next;
      const occupied = s.board.filter((cell) => cell !== null).length;
      expect(occupied).toBeLessThanOrEqual(2 * s.maxMoves);
      expect(occupied).toBeLessThan(9);
      // No winner and a full board would be a draw — the state F401 assumed.
      expect(s.winner === null && occupied === 9).toBe(false);
    }

    // The cap is what makes it true, not luck: 3 marks each on a 9-cell board.
    expect(2 * s.maxMoves).toBeLessThan(9);
    // And the game stays active until a win, never completing without one.
    expect(s.winner === null).toBe(s.gameStatus === "ACTIVE");
  });
});

describe("getNextPlayerSymbol", () => {
  it("alternates X and O", () => {
    expect(getNextPlayerSymbol(PlayerSymbol.X)).toBe(PlayerSymbol.O);
    expect(getNextPlayerSymbol(PlayerSymbol.O)).toBe(PlayerSymbol.X);
  });
});

describe("oppositeSymbol", () => {
  it("returns O for X", () => {
    expect(oppositeSymbol(PlayerSymbol.X)).toBe(PlayerSymbol.O);
  });
  it("returns X for O", () => {
    expect(oppositeSymbol(PlayerSymbol.O)).toBe(PlayerSymbol.X);
  });
});

describe("oppositeColor", () => {
  it("returns a different color", () => {
    expect(oppositeColor(Color.BLUE)).not.toBe(Color.BLUE);
  });
  it("is symmetric", () => {
    expect(oppositeColor(oppositeColor(Color.GREEN))).toBe(Color.GREEN);
  });
});

describe("PLAYER_CONFIG", () => {
  it("has both X and O with labels and default colors", () => {
    expect(PLAYER_CONFIG[PlayerSymbol.X].label).toBeTruthy();
    expect(PLAYER_CONFIG[PlayerSymbol.O].label).toBeTruthy();
    expect(PLAYER_CONFIG[PlayerSymbol.X].defaultColor).toBe(Color.BLUE);
  });
});

describe("3-piece removal and winning line interaction", () => {
  it("detects a win formed by the new piece after the oldest is removed", () => {
    // X has pieces at [0, 4, 6] (oldest → newest).
    // X places at 2, removing 0. New positions: [4, 6, 2] → diagonal [2, 4, 6] wins.
    let s = createInitialGameState({
      gameMode: GameModes.VS_FRIEND,
      playerXName: "A",
      playerOName: "B",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    // Build X: [0, 4, 6], O: [1, 3, 5] (no winner).
    s = makeMove(s, 0)!; // X
    s = makeMove(s, 1)!; // O
    s = makeMove(s, 4)!; // X
    s = makeMove(s, 3)!; // O
    s = makeMove(s, 6)!; // X
    s = makeMove(s, 5)!; // O
    expect(s.winner).toBeNull();
    expect(s.moves[PlayerSymbol.X]).toEqual([0, 4, 6]);

    // X places at 2 — oldest (0) is removed, forming [2, 4, 6] diagonal.
    s = makeMove(s, 2)!;
    expect(s.board[0]).toBeNull(); // oldest removed
    expect(s.board[2]).toBe(PlayerSymbol.X);
    expect(s.winner).toBe(PlayerSymbol.X);
    expect(s.winningCombination).toEqual([2, 4, 6]);
    expect(s.gameStatus).toBe(GameStatus.COMPLETED);
  });

  it("does not detect a win that depends on the removed piece", () => {
    // F477: checking the winner before eviction would invent a top-row win.
    // X has [0, 1, 4] (oldest → newest); O has [3, 5, 7].
    let s = createInitialGameState({
      gameMode: GameModes.VS_FRIEND,
      playerXName: "A",
      playerOName: "B",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    s = makeMove(s, 0)!; // X
    s = makeMove(s, 3)!; // O
    s = makeMove(s, 1)!; // X
    s = makeMove(s, 5)!; // O
    s = makeMove(s, 4)!; // X
    s = makeMove(s, 7)!; // O
    expect(s.winner).toBeNull();
    expect(s.moves[PlayerSymbol.X]).toEqual([0, 1, 4]);

    // With the oldest piece retained, the new move completes only [0, 1, 2].
    const beforeEviction = s.board.slice();
    beforeEviction[2] = PlayerSymbol.X;
    expect(checkWinner(beforeEviction)).toEqual({
      winner: PlayerSymbol.X,
      combination: [0, 1, 2],
    });

    // The real move evicts 0, leaving [1, 4, 2] with no winning line.
    s = makeMove(s, 2)!;
    expect(s.board[0]).toBeNull();
    expect(s.board[2]).toBe(PlayerSymbol.X);
    expect(s.winner).toBeNull();
    expect(s.winningCombination).toBeNull();
    expect(s.moves[PlayerSymbol.X]).toEqual([1, 4, 2]);
    expect(s.gameStatus).toBe(GameStatus.ACTIVE);
  });
});
