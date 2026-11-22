import { beforeAll, describe, expect, it } from "vitest";
import { Color, PlayerSymbol, SymbolShape } from "./constants";
import {
  getValidMoves,
  isGameActive,
  makeMove,
  type GameState,
} from "./logic";
import {
  createTutorialGame,
  lessonStage,
  tutorialAIMove,
} from "./tutorial";

const profile = { displayName: "Maria", color: Color.GREEN, shape: SymbolShape.STAR };
const HUMAN = PlayerSymbol.X;
const AI = PlayerSymbol.O;
const MAX_PLIES = 20;

const keyOf = (state: GameState): string =>
  JSON.stringify([
    state.board,
    state.currentPlayer,
    state.winner,
    state.gameStatus,
    state.maxMoves,
    state.moveCount,
    state.moves[HUMAN],
    state.moves[AI],
  ]);

const reachableStates = (): GameState[] => {
  const seen = new Set<string>();
  const states: GameState[] = [];
  const queue: GameState[] = [createTutorialGame(profile)];
  for (let head = 0; head < queue.length; head += 1) {
    const state = queue[head];
    const key = keyOf(state);
    if (seen.has(key)) continue;
    seen.add(key);
    states.push(state);
    if (!isGameActive(state) || state.moveCount >= MAX_PLIES) continue;
    if (state.currentPlayer === HUMAN) {
      for (const cell of getValidMoves(state.board)) {
        const next = makeMove(state, cell);
        if (next) queue.push(next);
      }
    } else {
      const reply = tutorialAIMove(state);
      if (reply !== null) {
        const next = makeMove(state, reply);
        if (next) queue.push(next);
      }
    }
  }
  return states;
};

const play = (cells: number[]): GameState =>
  cells.reduce((state, cell) => {
    const next = makeMove(state, cell);
    if (!next) throw new Error(`illegal move ${cell}`);
    return next;
  }, createTutorialGame(profile));

describe("the practice opponent over every reachable board", () => {
  let states: GameState[];

  beforeAll(() => {
    states = reachableStates();
  }, 20_000);

  it("enumerates a real game tree, not just the opening", () => {
    expect(states.length).toBeGreaterThan(10_000);
  });

  it("never returns a cell that completes the AI line", () => {
    const violations: string[] = [];
    let aiTurns = 0;
    for (const state of states) {
      if (!isGameActive(state) || state.currentPlayer !== AI) continue;
      aiTurns += 1;
      const reply = tutorialAIMove(state);
      if (reply === null) continue;
      if (!getValidMoves(state.board).includes(reply)) {
        violations.push(`cell ${reply} is not empty`);
        continue;
      }
      const next = makeMove(state, reply);
      if (!next) violations.push(`engine refused cell ${reply}`);
      else if (next.winner === AI) violations.push(`cell ${reply} completes an AI line`);
    }
    expect(aiTurns).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it("says won only when the human actually won", () => {
    const dishonest = states.filter(
      (state) => (lessonStage(state) === "won") !== (state.winner === HUMAN),
    );
    expect(dishonest).toEqual([]);
  });
});

describe("lessonStage on a board the AI took", () => {
  it("parks a lost round on the last lesson beat, never a win claim", () => {
    const aiTakesThirdMove = [3, 0, 5, 1, 7, 2];
    const aiTakesFifthMove = [5, 7, 6, 8, 3, 0, 4, 1, 7, 2];
    for (const cells of [aiTakesThirdMove, aiTakesFifthMove]) {
      const lost = play(cells);
      expect(lost.winner).toBe(AI);
      expect(lessonStage(lost)).toBe("vanished");
    }
  });
});

describe("tutorialAIMove when every legal reply would complete an AI line", () => {
  it("has no honest move and returns null", () => {
    const everyEmptyCellIsAnAIWin: GameState = {
      ...createTutorialGame(profile),
      board: [AI, AI, null, AI, HUMAN, HUMAN, null, HUMAN, HUMAN],
      moves: { [HUMAN]: [4, 5, 7], [AI]: [0, 1] },
      currentPlayer: AI,
      moveCount: 5,
    };
    expect(tutorialAIMove(everyEmptyCellIsAnAIWin)).toBeNull();
  });
});
