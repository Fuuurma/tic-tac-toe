import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  AI_Difficulty,
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
} from "./constants";
import { getValidMoves, makeMove, type GameState } from "./logic";
import {
  createTutorialGame,
  findWinningMove,
  humanMoveCount,
  lessonStage,
  tutorialAIMove,
} from "./tutorial";

const profile = { displayName: "Maria", color: Color.GREEN, shape: SymbolShape.STAR };
const HUMAN = PlayerSymbol.X;
const AI = PlayerSymbol.O;

/** Plays cells in order, alternating human then AI, through the real engine. */
const play = (cells: number[], from = createTutorialGame(profile)): GameState =>
  cells.reduce((state, cell) => {
    const next = makeMove(state, cell);
    if (!next) throw new Error(`illegal move ${cell}`);
    return next;
  }, from);

describe("createTutorialGame", () => {
  it("seats the player first, with their own name, color and symbol", () => {
    const game = createTutorialGame(profile);

    expect(game.gameStatus).toBe(GameStatus.ACTIVE);
    expect(game.gameMode).toBe(GameModes.VS_COMPUTER);
    expect(game.aiDifficulty).toBe(AI_Difficulty.EASY);
    expect(game.currentPlayer).toBe(HUMAN);
    expect(game.players[HUMAN]).toMatchObject({
      username: "Maria",
      color: Color.GREEN,
      shape: SymbolShape.STAR,
      type: "HUMAN",
    });
  });

  it("never makes the AI gray, which all but disappears on the board's dark well", () => {
    // Pink's usual opposite is gray; a practice opponent you cannot see teaches nothing.
    const game = createTutorialGame({ ...profile, color: Color.PINK });
    expect(game.players[AI].color).not.toBe(Color.GRAY);
    expect(game.players[AI].color).not.toBe(Color.PINK);
  });

  it("gives the AI a color and symbol that cannot be mistaken for the player's", () => {
    const game = createTutorialGame(profile);
    expect(game.players[AI].type).toBe("COMPUTER");
    expect(game.players[AI].color).not.toBe(Color.GREEN);
    expect(game.players[AI].shape).not.toBe(SymbolShape.STAR);

    const playsO = createTutorialGame({ ...profile, shape: SymbolShape.O });
    expect(playsO.players[AI].shape).toBe(SymbolShape.X);
  });
});

describe("lessonStage", () => {
  it("walks place, limit, vanished, win by how many marks the player has placed", () => {
    // Human moves are the even entries; the AI replies in between.
    const stageAfter = (cells: number[]) => lessonStage(play(cells));

    // Neither side completes a line anywhere in this script.
    const script = [0, 4, 1, 8, 5, 3, 7, 2, 6];
    expect(stageAfter(script.slice(0, 0))).toBe("place");
    expect(stageAfter(script.slice(0, 2))).toBe("place");
    expect(stageAfter(script.slice(0, 4))).toBe("place");
    expect(stageAfter(script.slice(0, 6))).toBe("limit");
    expect(stageAfter(script.slice(0, 8))).toBe("vanished");
    expect(stageAfter(script.slice(0, 9))).toBe("win");
  });

  it("reports the win as soon as the player completes a line", () => {
    const won = play([0, 3, 1, 4, 2]);
    expect(lessonStage(won)).toBe("won");
  });

  it("counts only the player's moves", () => {
    expect(humanMoveCount(play([]))).toBe(0);
    expect(humanMoveCount(play([0]))).toBe(1);
    expect(humanMoveCount(play([0, 4]))).toBe(1);
    expect(humanMoveCount(play([0, 4, 1]))).toBe(2);
  });
});

describe("findWinningMove", () => {
  it("finds the cell that completes a line", () => {
    // Human 0,1 with 2 open; AI far away.
    const state = play([0, 8, 1, 5]);
    expect(findWinningMove(state, HUMAN)).toBe(2);
  });

  it("answers for a side that is not on the move", () => {
    const state = play([0, 8, 1]);
    expect(state.currentPlayer).toBe(AI);
    expect(findWinningMove(state, HUMAN)).toBe(2);
  });

  it("respects vanishing: a line that needs the oldest mark is not a win", () => {
    // Human marks 4 (oldest), 1, 3 with 5 and 7 taken or not: placing 5 would
    // retire the 4 that 3-4-5 needs, so it must not be offered as a win.
    const state = play([4, 0, 1, 7, 3, 8]);
    expect(findWinningMove(state, HUMAN)).toBeNull();
  });

  it("offers the line whose marks all survive the vanish", () => {
    // Human marks 0 (oldest), 1, 4. 0-1-2 needs the doomed 0; 1-4-7 does not.
    const state = play([0, 8, 1, 5, 4, 6]);
    expect(findWinningMove(state, HUMAN)).toBe(7);
  });

  it("returns null when nothing wins", () => {
    expect(findWinningMove(createTutorialGame(profile), HUMAN)).toBeNull();
  });
});

describe("tutorialAIMove", () => {
  it("does not move out of turn or after the game ends", () => {
    expect(tutorialAIMove(createTutorialGame(profile))).toBeNull();
    expect(tutorialAIMove(play([0, 3, 1, 4, 2]))).toBeNull();
  });

  it("blocks a winning line while the player is still learning", () => {
    // Human 0,1 threatens 2 on their second move.
    const state = play([0, 8, 1]);
    expect(tutorialAIMove(state)).toBe(2);
  });

  it("still blocks on the reply to the player's 3rd mark", () => {
    // Human 0,1,4: a 4th mark on 7 retires the 0 and leaves 1-4-7.
    const state = play([0, 8, 1, 2, 4]);
    expect(humanMoveCount(state)).toBe(3);
    expect(findWinningMove(state, HUMAN)).toBe(7);
    expect(tutorialAIMove(state)).toBe(7);
  });

  it("stops blocking once the player has seen a mark vanish", () => {
    // Human placed 0,1,4,3: the 0 is gone and the 5th mark on 5 makes 3-4-5.
    const state = play([0, 8, 1, 6, 4, 2, 3]);
    expect(humanMoveCount(state)).toBe(4);
    expect(findWinningMove(state, HUMAN)).toBe(5);
    expect(tutorialAIMove(state)).not.toBe(5);
    expect(getValidMoves(state.board)).toContain(tutorialAIMove(state));
  });

  it("never completes a line of its own", () => {
    // AI holds 0 and 1 and 2 would win for it.
    const state = play([8, 0, 7, 1, 4]);
    expect(findWinningMove(state, AI)).toBe(2);
    expect(tutorialAIMove(state)).not.toBe(2);
  });

  it("only ever picks an empty cell", () => {
    const state = play([0, 4, 1]);
    expect(getValidMoves(state.board)).toContain(tutorialAIMove(state));
  });
});

describe("a full tutorial, whatever the player does", () => {
  const playerMoves = fc.array(fc.nat(), { minLength: 1, maxLength: 40 });

  /** Replays arbitrary human taps against the tutorial AI. */
  const simulate = (picks: number[]) => {
    let state = createTutorialGame(profile);
    const history: GameState[] = [state];
    for (const pick of picks) {
      if (state.winner) break;
      const valid = getValidMoves(state.board);
      const afterHuman = makeMove(state, valid[pick % valid.length]);
      if (!afterHuman) throw new Error("engine refused a valid move");
      state = afterHuman;
      history.push(state);
      if (state.winner) break;
      const reply = tutorialAIMove(state);
      if (reply === null) throw new Error("AI had no reply");
      const afterAI = makeMove(state, reply);
      if (!afterAI) throw new Error("engine refused the AI move");
      state = afterAI;
      history.push(state);
    }
    return history;
  };

  it("never lets the AI win", () => {
    fc.assert(
      fc.property(playerMoves, (picks) => {
        expect(simulate(picks).every((s) => s.winner !== AI)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("never lets the player win before their 4th mark, so the vanish is always seen first", () => {
    fc.assert(
      fc.property(playerMoves, (picks) => {
        const early = simulate(picks).filter(
          (s) => s.winner === HUMAN && humanMoveCount(s) < 4,
        );
        expect(early).toHaveLength(0);
      }),
      { numRuns: 300 },
    );
  });
});
