import { describe, expect, it } from "vitest";
import {
  Color,
  GameModes,
  PlayerSymbol,
  PLAYER_CONFIG,
} from "@/game/constants";
import {
  canMakeMove,
  checkWinner,
  createInitialGameState,
  freshGameState,
  getNextPlayerSymbol,
  getValidMoves,
  isValidMove,
  makeMove,
  resolveOpponentColor,
} from "@/game/logic";

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
  it("initializes players, sets X active and the game active", () => {
    const state = createInitialGameState({
      gameMode: GameModes.VS_COMPUTER,
      playerXName: "Alice",
      playerOName: "Bot",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });
    expect(state.players[PlayerSymbol.X].username).toBe("Alice");
    expect(state.players[PlayerSymbol.X].color).toBe(Color.BLUE);
    expect(state.players[PlayerSymbol.X].isActive).toBe(true);
    expect(state.players[PlayerSymbol.O].type).toBe("COMPUTER");
    expect(state.players[PlayerSymbol.O].isActive).toBe(true);
    expect(state.gameStatus).toBe("ACTIVE");
    expect(state.gameMode).toBe(GameModes.VS_COMPUTER);
  });
});

describe("getValidMoves", () => {
  it("returns all empty indices for an empty board", () => {
    const state = freshGameState();
    expect(getValidMoves(state.board)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("excludes occupied cells", () => {
    const state = makeMove(freshGameState(), 4)!;
    const valid = getValidMoves(state.board);
    expect(valid).not.toContain(4);
    expect(valid).toHaveLength(8);
  });
});

describe("isValidMove", () => {
  it("rejects moves after the game has ended", () => {
    const state = freshGameState();
    let s = makeMove(state, 0)!;
    s = makeMove(s, 3)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 2)!;
    expect(s.winner).toBe(PlayerSymbol.X);
    expect(isValidMove(s, 5, PlayerSymbol.O)).toBe(false);
  });

  it("rejects moves on occupied cells", () => {
    const state = makeMove(freshGameState(), 4)!;
    expect(isValidMove(state, 4, PlayerSymbol.O)).toBe(false);
  });

  it("rejects moves by the wrong player", () => {
    const state = freshGameState();
    expect(isValidMove(state, 0, PlayerSymbol.O)).toBe(false);
  });
});

describe("checkWinner", () => {
  it("detects a row win for X", () => {
    let s = freshGameState();
    s = makeMove(s, 0)!;
    s = makeMove(s, 3)!;
    s = makeMove(s, 1)!;
    s = makeMove(s, 4)!;
    s = makeMove(s, 2)!;
    const { winner, combination } = checkWinner(s.board);
    expect(winner).toBe(PlayerSymbol.X);
    expect(combination).toEqual([0, 1, 2]);
  });

  it("detects a column win for O", () => {
    let s = freshGameState();
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
    let s = freshGameState();
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
    const s = makeMove(freshGameState(), 0)!;
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
});

describe("canMakeMove", () => {
  it("only allows the local player to move in vs Computer mode", () => {
    expect(canMakeMove(GameModes.VS_COMPUTER, PlayerSymbol.X, PlayerSymbol.X)).toBe(true);
    expect(canMakeMove(GameModes.VS_COMPUTER, PlayerSymbol.O, PlayerSymbol.X)).toBe(false);
  });
});

describe("getNextPlayerSymbol", () => {
  it("alternates X and O", () => {
    expect(getNextPlayerSymbol(PlayerSymbol.X)).toBe(PlayerSymbol.O);
    expect(getNextPlayerSymbol(PlayerSymbol.O)).toBe(PlayerSymbol.X);
  });
});

describe("resolveOpponentColor", () => {
  it("avoids the same color in vs Friend mode", () => {
    expect(resolveOpponentColor(GameModes.VS_FRIEND, Color.BLUE, Color.BLUE)).not.toBe(Color.BLUE);
  });
  it("keeps the opponent color in vs Computer mode", () => {
    expect(resolveOpponentColor(GameModes.VS_COMPUTER, Color.BLUE, Color.RED)).toBe(Color.RED);
  });
});

describe("PLAYER_CONFIG", () => {
  it("has both X and O with labels and default colors", () => {
    expect(PLAYER_CONFIG[PlayerSymbol.X].label).toBeTruthy();
    expect(PLAYER_CONFIG[PlayerSymbol.O].label).toBeTruthy();
    expect(PLAYER_CONFIG[PlayerSymbol.X].defaultColor).toBe(Color.BLUE);
  });
});
