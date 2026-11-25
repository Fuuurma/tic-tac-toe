import { describe, expect, it } from "vitest";
import {
  AI_Difficulty,
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  WINNING_COMBINATIONS,
} from "@/game/constants";
import { createInitialGameState, makeMove, type GameState } from "@/game/logic";
import { applyForfeitIfActive } from "./peer.apply";
import { isPeerMessage } from "./peer.wire";

const onlineGame = () =>
  createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "Host",
    playerOName: "Guest",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });

const play = (state: GameState, ...indices: number[]): GameState => {
  let current = state;
  for (const index of indices) {
    const next = makeMove(current, index);
    if (!next) throw new Error(`move ${index} must be legal`);
    current = next;
  }
  return current;
};

const fresh = () => onlineGame();
const midGame = () => play(onlineGame(), 0, 3, 1);
const evictionGame = () => play(onlineGame(), 0, 1, 2, 3, 6, 5, 8, 7);
const wonGame = () => play(onlineGame(), 0, 3, 1, 4, 2);
const forfeitedGame = (state: GameState, survivor: PlayerSymbol) =>
  applyForfeitIfActive(state, survivor);

const update = (gameState: GameState) => ({ type: "gameUpdate", gameState }) as const;
const snapshot = (gameState: GameState) => ({ type: "state_snapshot", gameState }) as const;
const joined = (gameState: GameState, symbol: PlayerSymbol = PlayerSymbol.X) =>
  ({
    type: "joined",
    symbol,
    color: gameState.players[symbol].color,
    gameState,
  }) as const;
const start = (gameState: GameState, symbol: PlayerSymbol = PlayerSymbol.X) =>
  ({ type: "gameStart", symbol, gameState }) as const;

const stateFrames = (gameState: GameState) => [
  update(gameState),
  snapshot(gameState),
  joined(gameState),
] as const;

const expectDropped = (gameState: GameState) => {
  for (const frame of stateFrames(gameState)) {
    expect(isPeerMessage(frame)).toBe(false);
  }
};

const withBoardCell = (
  state: GameState,
  index: number,
  cell: PlayerSymbol | null,
): GameState => {
  const board = state.board.slice();
  board[index] = cell;
  return { ...state, board };
};

describe("producer-generated states validate", () => {
  it("accepts a fresh online state on every state-bearing frame", () => {
    const state = fresh();
    for (const frame of [...stateFrames(state), start(state)]) {
      expect(isPeerMessage(frame)).toBe(true);
    }
  });

  it("accepts a legal mid-game state produced by makeMove", () => {
    const state = midGame();
    expect(state.moveCount).toBe(3);
    for (const frame of stateFrames(state)) {
      expect(isPeerMessage(frame)).toBe(true);
    }
  });

  it("accepts the three-piece eviction path produced by makeMove", () => {
    const state = evictionGame();
    expect(state.moves[PlayerSymbol.X]).toEqual([2, 6, 8]);
    expect(state.moves[PlayerSymbol.O]).toEqual([3, 5, 7]);
    expect(state.nextToRemove).toEqual({
      [PlayerSymbol.X]: 2,
      [PlayerSymbol.O]: 3,
    });
    for (const frame of stateFrames(state)) {
      expect(isPeerMessage(frame)).toBe(true);
    }
  });

  it("accepts a legal completed state produced by makeMove", () => {
    const state = wonGame();
    expect(state.gameStatus).toBe(GameStatus.COMPLETED);
    expect(state.winner).toBe(PlayerSymbol.X);
    expect(state.winningCombination).toEqual([...WINNING_COMBINATIONS[0]]);
    for (const frame of stateFrames(state)) {
      expect(isPeerMessage(frame)).toBe(true);
    }
  });

  it("accepts a forfeit produced by applyForfeitIfActive and keeps its vanish pointers", () => {
    const state = forfeitedGame(evictionGame(), PlayerSymbol.O);
    expect(state.forfeited).toBe(true);
    expect(state.winner).toBe(PlayerSymbol.O);
    expect(state.nextToRemove).toEqual({
      [PlayerSymbol.X]: 2,
      [PlayerSymbol.O]: 3,
    });
    for (const frame of stateFrames(state)) {
      expect(isPeerMessage(frame)).toBe(true);
    }
    expect(isPeerMessage(start(state))).toBe(false);
  });
});

describe("online-mode agreement", () => {
  it("rejects a wire state whose gameMode is not ONLINE", () => {
    expectDropped({ ...fresh(), gameMode: GameModes.VS_COMPUTER });
    expect(isPeerMessage(start({ ...fresh(), gameMode: GameModes.VS_FRIEND }))).toBe(false);
  });

  it("rejects an ONLINE state with a computer player config", () => {
    const state = fresh();
    state.players[PlayerSymbol.X] = {
      ...state.players[PlayerSymbol.X],
      type: PlayerTypes.COMPUTER,
    };
    expectDropped(state);
  });

  it("rejects an ONLINE state that carries aiDifficulty", () => {
    expectDropped({ ...fresh(), aiDifficulty: AI_Difficulty.EASY });
    expect(
      isPeerMessage(start({ ...fresh(), aiDifficulty: AI_Difficulty.HARD })),
    ).toBe(false);
  });
});

describe("outcome/status agreement", () => {
  it("rejects a winner on a non-completed state", () => {
    const live = { ...wonGame(), gameStatus: GameStatus.ACTIVE, currentPlayer: PlayerSymbol.O };
    expectDropped(live);
  });

  it("rejects a completed state with no winner", () => {
    expectDropped({ ...fresh(), gameStatus: GameStatus.COMPLETED });
    expect(
      isPeerMessage(start({ ...fresh(), gameStatus: GameStatus.COMPLETED })),
    ).toBe(false);
  });
});

describe("board/outcome agreement", () => {
  it("rejects a complete line on the board when no winner is claimed", () => {
    const lineBoard = { ...wonGame(), winner: null, winningCombination: null };
    const state = {
      ...lineBoard,
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O,
      nextToRemove: {
        [PlayerSymbol.X]: lineBoard.moves[PlayerSymbol.X][0],
        [PlayerSymbol.O]: null,
      },
    };
    expect(state.board[0]).toBe(PlayerSymbol.X);
    expect(state.board[1]).toBe(PlayerSymbol.X);
    expect(state.board[2]).toBe(PlayerSymbol.X);
    expectDropped(state);
  });

  it("rejects a forfeit state whose board still holds a complete line", () => {
    const state = withBoardCell(
      forfeitedGame(midGame(), PlayerSymbol.X),
      2,
      PlayerSymbol.X,
    );
    expectDropped(state);
  });

  it("rejects a winningCombination that is only a permutation of the real line", () => {
    const state = { ...wonGame(), winningCombination: [2, 1, 0] as const };
    expectDropped(state);
  });

  it("rejects a claimed win while the opponent also holds a complete line", () => {
    const state: GameState = {
      ...wonGame(),
      board: [
        PlayerSymbol.X, PlayerSymbol.X, PlayerSymbol.X,
        PlayerSymbol.O, PlayerSymbol.O, PlayerSymbol.O,
        null, null, null,
      ],
      moves: {
        [PlayerSymbol.X]: [0, 1, 2],
        [PlayerSymbol.O]: [3, 4, 5],
      },
      nextToRemove: {
        [PlayerSymbol.X]: null,
        [PlayerSymbol.O]: 3,
      },
      moveCount: 7,
      lastMoveIndex: 2,
    };
    expect(state.winner).toBe(PlayerSymbol.X);
    expectDropped(state);
  });
});

describe("board/ledger agreement", () => {
  it("rejects a moves array that lists the same index twice", () => {
    const base = play(onlineGame(), 0, 3);
    const state: GameState = {
      ...base,
      moves: {
        [PlayerSymbol.X]: [0, 0],
        [PlayerSymbol.O]: [3],
      },
      moveCount: 3,
      lastMoveIndex: 0,
      currentPlayer: PlayerSymbol.O,
    };
    expectDropped(state);
  });

  it("rejects an occupied board cell that no moves array accounts for", () => {
    expectDropped(withBoardCell(midGame(), 5, PlayerSymbol.X));
  });

  it("rejects a moves entry whose board cell does not hold that symbol", () => {
    const base = midGame();
    const state: GameState = {
      ...base,
      moves: {
        [PlayerSymbol.X]: [0, 1, 5],
        [PlayerSymbol.O]: [3],
      },
      nextToRemove: {
        [PlayerSymbol.X]: 0,
        [PlayerSymbol.O]: null,
      },
      moveCount: 4,
      lastMoveIndex: 3,
      currentPlayer: PlayerSymbol.X,
    };
    expect(base.board[5]).toBeNull();
    expectDropped(state);
  });

  it("rejects a ledger whose X and O lengths differ by more than one", () => {
    const state: GameState = {
      ...fresh(),
      board: [
        PlayerSymbol.X, PlayerSymbol.X, null,
        null, null, null,
        null, null, null,
      ],
      moves: {
        [PlayerSymbol.X]: [0, 1],
        [PlayerSymbol.O]: [],
      },
      moveCount: 3,
      lastMoveIndex: 1,
      currentPlayer: PlayerSymbol.O,
    };
    expectDropped(state);
  });
});

describe("turn/ledger agreement", () => {
  it("rejects moveCount zero that still carries a lastMoveIndex", () => {
    expectDropped({ ...fresh(), lastMoveIndex: 4 });
  });

  it("rejects a lastMoveIndex that is not the last mover's final ledger entry", () => {
    const base = play(onlineGame(), 0, 3);
    expectDropped({ ...base, lastMoveIndex: 0 });
  });

  it("rejects a currentPlayer that contradicts moveCount parity", () => {
    const base = play(onlineGame(), 0, 3);
    expectDropped({ ...base, currentPlayer: PlayerSymbol.O });
  });

  it("rejects a moveCount smaller than the surviving ledger", () => {
    const base = play(onlineGame(), 0, 3);
    const state: GameState = {
      ...base,
      moveCount: 1,
      lastMoveIndex: 0,
      currentPlayer: PlayerSymbol.O,
    };
    expectDropped(state);
  });

  it("rejects a completed state whose currentPlayer is not the winner", () => {
    expectDropped({ ...wonGame(), currentPlayer: PlayerSymbol.O });
  });
});

describe("vanish-pointer agreement", () => {
  it("rejects a live state at the cap whose nextToRemove was cleared", () => {
    const state = {
      ...evictionGame(),
      nextToRemove: {
        [PlayerSymbol.X]: null,
        [PlayerSymbol.O]: 3,
      },
    };
    expectDropped(state);
  });

  it("rejects a below-cap ledger that still carries a vanish pointer", () => {
    const base = play(onlineGame(), 0);
    const state = {
      ...base,
      nextToRemove: {
        [PlayerSymbol.X]: 0,
        [PlayerSymbol.O]: null,
      },
    };
    expectDropped(state);
  });

  it("rejects a non-forfeit winner whose vanish pointer was not cleared", () => {
    const state = {
      ...wonGame(),
      nextToRemove: {
        [PlayerSymbol.X]: 0,
        [PlayerSymbol.O]: null,
      },
    };
    expectDropped(state);
  });

  it("rejects a forfeit whose pre-existing vanish pointer was cleared", () => {
    const state = {
      ...forfeitedGame(evictionGame(), PlayerSymbol.O),
      nextToRemove: {
        [PlayerSymbol.X]: 2,
        [PlayerSymbol.O]: null,
      },
    };
    expectDropped(state);
  });
});

describe("frame/envelope agreement", () => {
  it("rejects a joined frame whose color disagrees with the assigned player's color", () => {
    const state = fresh();
    expect(isPeerMessage(joined(state))).toBe(true);
    expect(
      isPeerMessage({
        type: "joined",
        symbol: PlayerSymbol.X,
        color: Color.RED,
        gameState: state,
      }),
    ).toBe(false);
    expect(
      isPeerMessage({
        type: "joined",
        symbol: PlayerSymbol.O,
        color: state.players[PlayerSymbol.O].color,
        gameState: state,
      }),
    ).toBe(true);
  });

  it("rejects a gameStart frame that does not carry a fresh ACTIVE game", () => {
    expect(isPeerMessage(start(fresh()))).toBe(true);
    expect(isPeerMessage(start(midGame()))).toBe(false);
    expect(isPeerMessage(start(wonGame()))).toBe(false);
    expect(isPeerMessage(start(fresh(), PlayerSymbol.O))).toBe(true);
  });

  it("rejects a gameStart frame whose state failed the outcome rules", () => {
    expect(
      isPeerMessage(start({ ...fresh(), gameStatus: GameStatus.COMPLETED })),
    ).toBe(false);
    expect(
      isPeerMessage(start({ ...fresh(), gameMode: GameModes.VS_COMPUTER })),
    ).toBe(false);
  });
});
