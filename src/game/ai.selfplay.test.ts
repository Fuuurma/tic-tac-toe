import { describe, expect, it } from "vitest";
import { AI_Difficulty, GameModes, Color, PlayerSymbol } from "@/game/constants";
import { getAIMove } from "@/game/ai";
import {
  createInitialGameState,
  getValidMoves,
  makeMove,
  type GameState,
} from "@/game/logic";

const onlineState = () =>
  createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "X",
    playerOName: "O",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });

function selfPlay(diff: AI_Difficulty, games = 30, maxPlies = 80) {
  let aiWins = 0;
  let humanWins = 0;
  let draws = 0;
  let illegalMoves = 0;
  for (let g = 0; g < games; g += 1) {
    let s = onlineState();
    for (let p = 0; p < maxPlies; p += 1) {
      if (s.winner !== null) break;
      const validMoves = getValidMoves(s.board);
      const m = getAIMove(s, diff, s.currentPlayer);
      if (m === null) {
        if (validMoves.length > 0) illegalMoves += 1;
        break;
      }
      if (!validMoves.includes(m)) {
        illegalMoves += 1;
        break;
      }
      const next = makeMove(s, m);
      if (!next) {
        illegalMoves += 1;
        break;
      }
      s = next;
    }
    if (s.winner !== null) {
      // In self-play there is no "human" vs "AI"; just label one symbol as
      // "first" and the other as "second" so we can compare balance.
      if (s.winner === PlayerSymbol.X) humanWins += 1;
      else aiWins += 1;
    } else {
      draws += 1;
    }
  }
  return { aiWins, humanWins, draws, illegalMoves };
}

interface MatchResult {
  challengerWins: number;
  opponentWins: number;
  draws: number;
  illegalMoves: number;
  bySymbol: Record<PlayerSymbol, Omit<MatchResult, "bySymbol">>;
}

const emptySideResult = (): Omit<MatchResult, "bySymbol"> => ({
  challengerWins: 0,
  opponentWins: 0,
  draws: 0,
  illegalMoves: 0,
});

const seededRandom = (seed: number): (() => number) => {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
};

const playMatch = (
  xDifficulty: AI_Difficulty,
  oDifficulty: AI_Difficulty,
  maxPlies = 120,
): GameState => {
  let state = onlineState();
  for (let ply = 0; ply < maxPlies && state.winner === null; ply += 1) {
    const difficulty =
      state.currentPlayer === PlayerSymbol.X ? xDifficulty : oDifficulty;
    const move = getAIMove(state, difficulty, state.currentPlayer);
    if (move === null || !getValidMoves(state.board).includes(move)) break;
    const next = makeMove(state, move);
    if (!next) break;
    state = next;
  }
  return state;
};

const versus = (
  challenger: AI_Difficulty,
  opponent: AI_Difficulty,
  gamesPerSide: number,
  seed: number,
): MatchResult => {
  const originalRandom = Math.random;
  const result: MatchResult = {
    ...emptySideResult(),
    bySymbol: {
      [PlayerSymbol.X]: emptySideResult(),
      [PlayerSymbol.O]: emptySideResult(),
    },
  };

  try {
    for (let game = 0; game < gamesPerSide; game += 1) {
      for (const challengerSymbol of [PlayerSymbol.X, PlayerSymbol.O]) {
        // Replay each game seed from both symbols so the comparison does not
        // depend on which seating order consumed the random stream first.
        Math.random = seededRandom(seed + game);
        const sideResult = result.bySymbol[challengerSymbol];
        const xDifficulty =
          challengerSymbol === PlayerSymbol.X ? challenger : opponent;
        const oDifficulty =
          challengerSymbol === PlayerSymbol.O ? challenger : opponent;
        const state = playMatch(xDifficulty, oDifficulty);
        if (
          state.winner === null &&
          getValidMoves(state.board).length > 0 &&
          state.moveCount < 120
        ) {
          result.illegalMoves += 1;
          sideResult.illegalMoves += 1;
        } else if (state.winner === null) {
          result.draws += 1;
          sideResult.draws += 1;
        } else if (state.winner === challengerSymbol) {
          result.challengerWins += 1;
          sideResult.challengerWins += 1;
        } else {
          result.opponentWins += 1;
          sideResult.opponentWins += 1;
        }
      }
    }
  } finally {
    Math.random = originalRandom;
  }

  return result;
};

describe("AI self-play safety", () => {
  it("Easy only produces legal moves", () => {
    const r = selfPlay(AI_Difficulty.EASY, 8);
    const total = r.aiWins + r.humanWins + r.draws;
    expect(total).toBe(8);
    expect(r.illegalMoves).toBe(0);
  });

  it("Normal Minimax only produces legal moves within the bounded simulation", () => {
    const r = selfPlay(AI_Difficulty.NORMAL, 6);
    const total = r.aiWins + r.humanWins + r.draws;
    expect(total).toBe(6);
    expect(r.illegalMoves).toBe(0);
  }, 30_000);

  it("Hard Minimax only produces legal moves within the bounded simulation", () => {
    const r = selfPlay(AI_Difficulty.HARD, 6);
    const total = r.aiWins + r.humanWins + r.draws;
    expect(total).toBe(6);
    expect(r.illegalMoves).toBe(0);
  }, 30_000);
});

describe("AI difficulty separation", () => {
  it("Normal clearly outperforms Easy from both symbols", () => {
    const result = versus(
      AI_Difficulty.NORMAL,
      AI_Difficulty.EASY,
      20,
      0x5eed,
    );
    expect(result).toEqual({
      challengerWins: 39,
      opponentWins: 1,
      draws: 0,
      illegalMoves: 0,
      bySymbol: {
        [PlayerSymbol.X]: {
          challengerWins: 20,
          opponentWins: 0,
          draws: 0,
          illegalMoves: 0,
        },
        [PlayerSymbol.O]: {
          challengerWins: 19,
          opponentWins: 1,
          draws: 0,
          illegalMoves: 0,
        },
      },
    });
  }, 30_000);

  it("Hard clearly outperforms Normal in seeded head-to-head play", () => {
    const result = versus(
      AI_Difficulty.HARD,
      AI_Difficulty.NORMAL,
      10,
      0xc0ffee,
    );
    expect(result).toEqual({
      challengerWins: 20,
      opponentWins: 0,
      draws: 0,
      illegalMoves: 0,
      bySymbol: {
        [PlayerSymbol.X]: {
          challengerWins: 10,
          opponentWins: 0,
          draws: 0,
          illegalMoves: 0,
        },
        [PlayerSymbol.O]: {
          challengerWins: 10,
          opponentWins: 0,
          draws: 0,
          illegalMoves: 0,
        },
      },
    });
  }, 30_000);
});
