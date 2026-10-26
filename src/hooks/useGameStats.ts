import { useCallback, useEffect, useState } from "react";
import {
  AI_DIFFICULTY_LABELS,
  AI_Difficulty,
  GameModes,
  type GameMode,
} from "@/game/constants";
import { getOrCreateGuestIdentity } from "@/lib/identity";

/** One win/loss tally for a single mode+difficulty bucket. */
export interface StatsBucket {
  wins: number;
  losses: number;
}

/**
 * Record decomposed by what the player actually chose. The key is
 * `mode` for modes without a difficulty and `mode:difficulty` for
 * vs Computer, so a bucket survives a difficulty label change and stays
 * readable straight out of localStorage.
 */
export type StatsBreakdown = Record<string, StatsBucket>;

/** Which game produced a result. Difficulty only applies to vs Computer. */
interface StatsContext {
  gameMode: GameMode;
  aiDifficulty?: AI_Difficulty;
}

export interface GameStats {
  totalGames: number;
  wins: number;
  losses: number;
  currentWinStreak: number;
  bestWinStreak: number;
  breakdown: StatsBreakdown;
}

const DEFAULT_BUCKET: StatsBucket = { wins: 0, losses: 0 };

const DEFAULT_STATS: GameStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  breakdown: {},
};

const storageKey = (guestId: string) => `tic-tac-toe:stats:${guestId}`;

export const breakdownKey = (
  gameMode: GameMode,
  aiDifficulty?: AI_Difficulty,
): string =>
  gameMode === GameModes.VS_COMPUTER && aiDifficulty
    ? `${gameMode}:${aiDifficulty}`
    : gameMode;

const isFiniteNonNegative = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

/**
 * Keeps only well-formed buckets. Anything else is dropped rather than
 * repaired: a bucket with a malformed tally is a corrupted record, and a
 * half-trusted number is worse than a missing one.
 */
const readBreakdown = (raw: unknown): StatsBreakdown => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const breakdown: StatsBreakdown = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const bucket = value as Partial<StatsBucket>;
    if (!isFiniteNonNegative(bucket.wins) || !isFiniteNonNegative(bucket.losses)) {
      continue;
    }
    breakdown[key] = { wins: bucket.wins, losses: bucket.losses };
  }
  return breakdown;
};

export const readStats = (guestId: string): GameStats => {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = window.localStorage.getItem(storageKey(guestId));
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw) as Partial<GameStats>;
    return {
      totalGames: isFiniteNonNegative(parsed.totalGames) ? parsed.totalGames : DEFAULT_STATS.totalGames,
      wins: isFiniteNonNegative(parsed.wins) ? parsed.wins : DEFAULT_STATS.wins,
      losses: isFiniteNonNegative(parsed.losses) ? parsed.losses : DEFAULT_STATS.losses,
      currentWinStreak: isFiniteNonNegative(parsed.currentWinStreak) ? parsed.currentWinStreak : DEFAULT_STATS.currentWinStreak,
      bestWinStreak: isFiniteNonNegative(parsed.bestWinStreak) ? parsed.bestWinStreak : DEFAULT_STATS.bestWinStreak,
      // Records written before the breakdown existed have no such field.
      breakdown: readBreakdown(parsed.breakdown),
    };
  } catch {
    return DEFAULT_STATS;
  }
};

const writeStats = (guestId: string, stats: GameStats): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(guestId), JSON.stringify(stats));
  } catch {
    // QuotaExceededError — stats will be lost but game continues
  }
};

/**
 * One recorded game applied to a stats snapshot — pure, so the merge
 * semantics (tallies, streaks) live in one testable place.
 */
export const applyGame = (
  stats: GameStats,
  key: string,
  won: boolean,
): GameStats => {
  const bucket = stats.breakdown[key] ?? DEFAULT_BUCKET;
  const breakdown = {
    ...stats.breakdown,
    [key]: {
      wins: bucket.wins + (won ? 1 : 0),
      losses: bucket.losses + (won ? 0 : 1),
    },
  };
  if (won) {
    return {
      ...stats,
      breakdown,
      totalGames: stats.totalGames + 1,
      wins: stats.wins + 1,
      currentWinStreak: stats.currentWinStreak + 1,
      bestWinStreak: Math.max(stats.bestWinStreak, stats.currentWinStreak + 1),
    };
  }
  return {
    ...stats,
    breakdown,
    totalGames: stats.totalGames + 1,
    losses: stats.losses + 1,
    currentWinStreak: 0,
  };
};

export function useGameStats() {
  const [guestId] = useState<string>(() => getOrCreateGuestIdentity().guestId);
  const [stats, setStats] = useState<GameStats>(() => readStats(guestId));

  const record = useCallback(
    (context: StatsContext, won: boolean) => {
      // Only vs Computer splits by difficulty; a friend or online result
      // has no difficulty to attribute it to.
      const key = breakdownKey(context.gameMode, context.aiDifficulty);
      // F791: merge into the FRESH stored snapshot, not React state —
      // another tab shares this guest identity (it lives in localStorage)
      // and may have recorded games since this hook last rendered. The
      // read-merge-write is synchronous against the shared store, so each
      // game adds exactly one tally to whatever is newest. Residual: two
      // tabs recording in the exact same instant still race (localStorage
      // has no compare-and-swap) — the window is microseconds, and the
      // storage-event resync below keeps both views honest afterwards.
      const merged = applyGame(readStats(guestId), key, won);
      writeStats(guestId, merged);
      setStats(merged);
    },
    [guestId],
  );

  const recordWin = useCallback(
    (context: StatsContext) => record(context, true),
    [record],
  );

  const recordLoss = useCallback(
    (context: StatsContext) => record(context, false),
    [record],
  );

  // F791: adopt a newer snapshot another tab wrote. Adoption happens
  // only on genuine difference — same-value storage events fire in some
  // browsers, and re-adopting identical stats would be a no-op anyway;
  // persistence is NOT on this path (record writes), so there is no
  // write/event loop.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey(guestId)) return;
      setStats((prev) => {
        const incoming = readStats(guestId);
        return JSON.stringify(incoming) === JSON.stringify(prev)
          ? prev
          : incoming;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [guestId]);

  return { stats, recordWin, recordLoss };
}

/** Bucket key + display label for a mode/difficulty pair. */
interface BreakdownRow {
  key: string;
  label: string;
  bucket: StatsBucket;
}

const MODE_LABELS: Record<GameMode, string> = {
  [GameModes.VS_COMPUTER]: "vs Computer",
  [GameModes.VS_FRIEND]: "vs Friend",
  [GameModes.ONLINE]: "Online",
};

/**
 * Rows for the breakdown panel: the mode being played right now first
 * (so its buckets are always visible, including untouched ones), then any
 * other mode that has a record. Modes with nothing recorded stay hidden
 * instead of padding the panel with rows of zeros.
 */
export const breakdownRows = (
  breakdown: StatsBreakdown,
  currentMode: GameMode | undefined,
): BreakdownRow[] => {
  const rows: BreakdownRow[] = [];
  const push = (gameMode: GameMode, difficulty?: AI_Difficulty) => {
    const key = breakdownKey(gameMode, difficulty);
    rows.push({
      key,
      label:
        gameMode === GameModes.VS_COMPUTER && difficulty
          ? AI_DIFFICULTY_LABELS[difficulty]
          : MODE_LABELS[gameMode],
      bucket: breakdown[key] ?? DEFAULT_BUCKET,
    });
  };

  const isEmpty = (key: string) => {
    const bucket = breakdown[key];
    return !bucket || (bucket.wins === 0 && bucket.losses === 0);
  };

  if (currentMode === GameModes.VS_COMPUTER) {
    for (const difficulty of [
      AI_Difficulty.EASY,
      AI_Difficulty.NORMAL,
      AI_Difficulty.HARD,
    ] as const) {
      push(GameModes.VS_COMPUTER, difficulty);
    }
  } else if (currentMode) {
    push(currentMode);
  }

  for (const gameMode of [
    GameModes.VS_COMPUTER,
    GameModes.VS_FRIEND,
    GameModes.ONLINE,
  ] as const) {
    if (gameMode === currentMode) continue;
    const keys =
      gameMode === GameModes.VS_COMPUTER
        ? [
            AI_Difficulty.EASY,
            AI_Difficulty.NORMAL,
            AI_Difficulty.HARD,
          ].map((d) => breakdownKey(gameMode, d))
        : [breakdownKey(gameMode)];
    if (!keys.some((key) => !isEmpty(key))) continue;
    if (gameMode === GameModes.VS_COMPUTER) {
      for (const difficulty of [
        AI_Difficulty.EASY,
        AI_Difficulty.NORMAL,
        AI_Difficulty.HARD,
      ] as const) {
        push(gameMode, difficulty);
      }
    } else {
      push(gameMode);
    }
  }

  return rows;
};