import { useCallback, useEffect, useSyncExternalStore } from "react";
import { GAME_ID } from "@/game/constants";
import {
  MATCHMAKING_CONFIGURED,
  fetchMatchmakingHealth,
  totalOnlinePlayers,
} from "@/lib/matchmaking";

export interface PlayerCount {
  /** Everyone the service could pair, right now. */
  players: number;
  /** Subset actively queueing — who a Quick Match would actually reach. */
  waiting: number;
}

const POLL_INTERVAL_MS = 15_000;
/** Back off instead of hammering a Worker that is already unhappy. */
const ERROR_BACKOFF_MS = 30_000;

/**
 * Live "N players online" for Online mode.
 *
 * Kept in a tiny module-level store rather than component state: polling is
 * not a render concern, and both the lobby and the online surface read it, so
 * one poller serves them instead of each mounting its own. useSyncExternal-
 * Store also keeps the poll loop out of the render path entirely.
 *
 * Stays null until the first successful read, so the UI can say nothing
 * rather than lie with a zero. A failed refresh keeps the last good number
 * instead of blanking the readout — a transient blip should not make the
 * lobby flicker between "7 online" and "unavailable".
 *
 * Polling pauses while the tab is hidden and catches up on refocus, so a
 * backgrounded lobby is not waking a Durable Object every 15 seconds for a
 * count nobody is looking at.
 */

let snapshot: PlayerCount | null = null;
let timer: number | null = null;
let subscribers = 0;
let inFlight = false;
let nextDelayMs = POLL_INTERVAL_MS;

const listeners = new Set<() => void>();

function publish(next: PlayerCount | null) {
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

async function poll(game: string): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const health = await fetchMatchmakingHealth(game);
    publish({ players: totalOnlinePlayers(health), waiting: health.waiting });
    nextDelayMs = POLL_INTERVAL_MS;
  } catch {
    // Unknown, not zero. Keep whatever we last knew and back off.
    nextDelayMs = ERROR_BACKOFF_MS;
  } finally {
    inFlight = false;
  }
}

function clearTimer() {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function schedule(game: string) {
  clearTimer();
  timer = window.setTimeout(() => {
    timer = null;
    void poll(game).then(() => schedule(game));
  }, nextDelayMs);
}

function acquire(game: string) {
  subscribers += 1;
  if (subscribers > 1) return;
  nextDelayMs = POLL_INTERVAL_MS;
  const onVisibility = () => {
    // Coming back to a hidden tab: the queued timer was throttled or
    // skipped, so re-read now rather than waiting out another backoff.
    if (document.visibilityState === "visible") {
      void poll(game).then(() => schedule(game));
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  void poll(game).then(() => schedule(game));
}

function release() {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0) return;
  clearTimer();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

export function usePlayerCount(
  enabled: boolean,
  game: string = GAME_ID,
): { count: PlayerCount | null; refresh: () => void } {
  const live = enabled && MATCHMAKING_CONFIGURED;

  useEffect(() => {
    if (!live) return;
    acquire(game);
    return () => release();
  }, [live, game]);

  const count = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const refresh = useCallback(() => {
    if (live) void poll(game);
  }, [live, game]);

  return { count: live ? count : null, refresh };
}