import { describe, expect, it } from "vitest";
import {
  AI_Difficulty,
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/game/constants";
import { applyAuthorizedMove } from "@/lib/peer.apply";
import {
  createInitialGameState,
  freshGameState,
  getValidMoves,
  makeMove,
  type GameState,
} from "@/game/logic";
import { getAIMove, type AiSearchStats } from "@/game/ai";

/**
 * AI move-cost budget on mobile-representative states.
 *
 * Mobile long-task budgets are roughly one ~16ms frame on 60Hz devices.
 * Anything beyond ~32ms risks dropped input. We report against a 100ms
 * budget because the user explicitly opts into AI search by starting a
 * `vs Computer` game.
 *
 * The gate is the minimax NODE COUNT, not wall-clock. Wall-clock assertions
 * on this suite were the red-main cause (TTT-AI-TIMING-RED1): each bench
 * test ran ~72 timed getAIMove calls, and vitest's default 5s testTimeout —
 * plus the ms ceilings — flipped red whenever the shared fleet host was
 * loaded, on code that had not changed. Node count is a property of the
 * search itself: identical on every machine, and it rises for exactly the
 * regressions this bench exists to catch — an extra alpha-beta ply
 * multiplies it, weaker move ordering or lost pruning inflates it.
 *
 * Ceilings calibrated 2026-11-16 (observed maxima: NORMAL 767 nodes on the
 * empty board, HARD 4,936 on the dead-end-eviction state) with ~2x
 * headroom. A depth bump multiplies nodes several-fold, so the ceilings
 * still catch it; heuristic tweaks that shuffle nodes between states stay
 * green. Milliseconds are still measured and reported — as a diagnostic
 * warn for the mobile budget, never an assertion.
 */
const MOBILE_MOVE_BUDGET_MS = 100;
const NODE_CEILING: Record<AI_Difficulty, number> = {
  [AI_Difficulty.EASY]: 0,
  [AI_Difficulty.NORMAL]: 1_600,
  [AI_Difficulty.HARD]: 10_000,
};

interface BenchRow {
  difficulty: AI_Difficulty;
  label: string;
  nodes: number;
  ms: number;
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
    s.gameStatus = GameStatus.ACTIVE;
    yield {
      label: "dead-end-eviction",
      state: applyAuthorizedMove(s, 4, PlayerSymbol.X)!,
    };
  }
}

/**
 * One timed call per difficulty/state pair — 12 calls total, ~0.5s even on
 * a slow host, so the suite cannot flirt with the test timeout the way the
 * old 72-sample benchmark did. `nodes` is exact; `ms` is a single sample,
 * which is all a warn-only diagnostic needs.
 */
function benchmark(): BenchRow[] {
  const rows: BenchRow[] = [];
  for (const difficulty of [
    AI_Difficulty.EASY,
    AI_Difficulty.NORMAL,
    AI_Difficulty.HARD,
  ] as const) {
    for (const { label, state } of representativeMobileStates()) {
      const stats: AiSearchStats = { nodes: -1 };
      const start = performance.now();
      getAIMove(state, difficulty, state.currentPlayer, stats);
      rows.push({
        difficulty,
        label,
        nodes: stats.nodes,
        ms: performance.now() - start,
      });
    }
  }
  return rows;
}

describe("AI move cost (mobile representative states)", () => {
  it("Easy never searches — zero minimax nodes on every state", () => {
    const rows = benchmark();
    for (const row of rows) {
      if (row.difficulty !== AI_Difficulty.EASY) continue;
      expect(row.nodes, `Easy move (${row.label})`).toBe(0);
    }
  });

  it("keeps search node counts under deterministic ceilings", () => {
    const rows = benchmark();
    for (const row of rows) {
      if (row.difficulty === AI_Difficulty.EASY) continue;
      // The search must actually run — a broken stats path would report 0
      // and pass the ceiling vacuously.
      expect(row.nodes, `${row.difficulty} move (${row.label})`).toBeGreaterThan(0);
      expect(
        row.nodes,
        `${row.difficulty} move (${row.label}) exceeded the node ceiling`,
      ).toBeLessThanOrEqual(NODE_CEILING[row.difficulty]);
    }
    // Wall-clock stays a report, not a gate: a loaded shared host inflates
    // it without the search changing, so it can warn but never fail.
    const overBudget = rows.filter(
      (row) =>
        row.difficulty !== AI_Difficulty.EASY && row.ms > MOBILE_MOVE_BUDGET_MS,
    );
    if (overBudget.length > 0) {
      console.warn(
        `[ai.bench] ${overBudget.length} AI/state pairs exceed the ${MOBILE_MOVE_BUDGET_MS}ms mobile budget on this host; recommend Web Worker offload for ${Array.from(new Set(overBudget.map((r) => r.difficulty))).join(", ")}.`,
      );
    }
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
    // Floor, not max: the fastest of many calls is the machine's achievable
    // time, so a scheduler hiccup or GC pause on a loaded host cannot move
    // it — the same reason the search ceiling above uses node count. A real
    // per-call regression still lifts every sample together.
    const samples: number[] = [];
    for (let game = 0; game < 4; game += 1) {
      let s = baseGame();
      for (let i = 0; i < 18; i += 1) {
        const valid = getValidMoves(s.board);
        const idx = valid[i % valid.length];
        const t0 = performance.now();
        const next = makeMove(s, idx);
        samples.push(performance.now() - t0);
        if (!next) break;
        s = next;
      }
    }
    expect(Math.min(...samples)).toBeLessThan(5);
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
