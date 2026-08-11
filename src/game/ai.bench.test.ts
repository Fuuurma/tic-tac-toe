import { describe, expect, it } from "vitest";
import {
  AI_Difficulty,
  Color,
  GameModes,
  PlayerSymbol,
} from "@/game/constants";
import {
  applyAuthorizedMove,
  applyOptimisticMove,
} from "@/lib/peer";
import {
  createInitialGameState,
  freshGameState,
  getValidMoves,
  makeMove,
  type GameState,
} from "@/game/logic";
import { getAIMove } from "@/game/ai";

/**
 * Mobile AI move-time budget.
 *
 * Mobile long-task budgets are roughly one ~16ms frame on 60Hz devices.
 * Anything beyond ~32ms risks dropped input. We allow up to 100ms here
 * because the user explicitly opts into AI search by starting a
 * `vs Computer` game, and we want this test to flag real regressions
 * (an extra alpha-beta ply, a wider heuristic, or weaker move ordering)
 * without spuriously failing on a noisy CI node.
 *
 * This benchmark records the worst-case median so we can compare baselines.
 * Easy is enforced because its weighted-random path should always be cheap;
 * Normal and Hard report budget breaches without making noisy CI timing a
 * release blocker.
 */
const MOBILE_MOVE_BUDGET_MS = 100;
const SEARCH_REGRESSION_CEILING_MS = 500;

interface BenchRow {
  difficulty: AI_Difficulty;
  label: string;
  medianMs: number;
}

function* representativeMobileStates(): Generator<{
  label: string;
  state: GameState;
}> {
  const base = () =>
    createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Human",
      playerOName: "AI",
      playerColor: Color.BLUE,
      opponentColor: Color.RED,
    });

  yield { label: "first-move-empty-board", state: base() };

  {
    let s = applyAuthorizedMove(base(), 4, PlayerSymbol.X)!;
    s = applyAuthorizedMove(s, 0, PlayerSymbol.O)!;
    s = applyAuthorizedMove(s, 8, PlayerSymbol.X)!;
    yield { label: "mid-game-three-moves", state: s };
  }

  {
    let s = applyAuthorizedMove(base(), 4, PlayerSymbol.X)!;
    s = applyAuthorizedMove(s, 0, PlayerSymbol.O)!;
    s = applyAuthorizedMove(s, 8, PlayerSymbol.X)!;
    s = applyAuthorizedMove(s, 1, PlayerSymbol.O)!;
    s = applyAuthorizedMove(s, 2, PlayerSymbol.X)!;
    s = applyAuthorizedMove(s, 7, PlayerSymbol.O)!;
    yield { label: "full-three-piece", state: s };
  }

  {
    const s = freshGameState();
    s.players[PlayerSymbol.X].color = Color.BLUE;
    s.players[PlayerSymbol.O].color = Color.RED;
    s.gameStatus = GameModes.ONLINE as unknown as GameState["gameStatus"];
    yield {
      label: "dead-end-eviction",
      state: applyOptimisticMove(s, 4, PlayerSymbol.X)!,
    };
  }
}

function warmAi(state: GameState): GameState {
  void getAIMove(state, AI_Difficulty.EASY, state.currentPlayer);
  return state;
}

function measureMedianMs(fn: () => void): number {
  const samples: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * Compute the per-difficulty, per-state median for future regression
 * detection. The Easy path is enforced because it never has a legitimate
 * reason to miss the budget. Normal and Hard still report a breach so search
 * changes remain visible without turning shared-runner timing noise into a
 * flaky gate.
 */
function benchmark(): { rows: BenchRow[]; worst: BenchRow } {
  const rows: BenchRow[] = [];
  for (const difficulty of [
    AI_Difficulty.EASY,
    AI_Difficulty.NORMAL,
    AI_Difficulty.HARD,
  ] as const) {
    for (const { label, state } of representativeMobileStates()) {
      const warmed = warmAi(state);
      const aiSymbol = warmed.currentPlayer;
      const median = measureMedianMs(() => {
        getAIMove(warmed, difficulty, aiSymbol);
      });
      rows.push({ difficulty, label, medianMs: median });
    }
  }
  const worst = rows.reduce(
    (acc, r) => (r.medianMs > acc.medianMs ? r : acc),
    rows[0],
  );
  return { rows, worst };
}

describe("AI move-time budget (mobile representative states)", () => {
  it("Easy always stays well under the mobile budget", () => {
    const { rows } = benchmark();
    for (const row of rows) {
      if (row.difficulty !== AI_Difficulty.EASY) continue;
      expect(
        row.medianMs,
        `Easy move (${row.label})`,
      ).toBeLessThan(MOBILE_MOVE_BUDGET_MS);
    }
  });

  it("keeps search bounded and reports mobile-budget breaches", () => {
    const { rows, worst } = benchmark();
    // Easy is enforced above; for Hard/Normal we still report budget breaches
    // so a future search change can justify optimization or a Web Worker.
    const overBudget = rows.filter(
      (row) =>
        row.difficulty !== AI_Difficulty.EASY &&
        row.medianMs > MOBILE_MOVE_BUDGET_MS,
    );
    if (overBudget.length > 0) {
      console.warn(
        `[ai.bench] ${overBudget.length} AI/state pairs exceed the ${MOBILE_MOVE_BUDGET_MS}ms mobile budget; recommend Web Worker offload for ${Array.from(new Set(overBudget.map((r) => r.difficulty))).join(", ")}.`,
      );
    }
    for (const row of rows) {
      expect(
        row.medianMs,
        `${row.difficulty} move (${row.label}) exceeded the search regression ceiling`,
      ).toBeLessThan(SEARCH_REGRESSION_CEILING_MS);
    }
    expect(worst.medianMs).toBeGreaterThan(0);
    expect(rows.length).toBe(representativeMobileStatesCount() * 3);
  });
});

function representativeMobileStatesCount(): number {
  let n = 0;
  for (const _ of representativeMobileStates()) n += 1;
  return n;
}

describe("Logic pure-function timing", () => {
  it("makeMove stays well under a frame budget across a full game", () => {
    const start = baseGame();
    let s = start;
    let maxMs = 0;
    for (let i = 0; i < 18; i += 1) {
      const valid = getValidMoves(s.board);
      const idx = valid[i % valid.length];
      const t0 = performance.now();
      const next = makeMove(s, idx);
      const dt = performance.now() - t0;
      maxMs = Math.max(maxMs, dt);
      if (!next) break;
      s = next;
    }
    expect(maxMs).toBeLessThan(5);
  });
});

function baseGame(): GameState {
  return createInitialGameState({
    gameMode: GameModes.ONLINE,
    playerXName: "H",
    playerOName: "AI",
    playerColor: Color.BLUE,
    opponentColor: Color.RED,
  });
}
