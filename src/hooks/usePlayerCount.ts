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
/**
 * Reachability, separate from the count. True only once a poll has failed
 * with no successful read ever (this session): "proven down", never
 * "unknown". A mid-session blip keeps the last good number and never
 * flips this, so the UI cannot flicker between live and dead. A later
 * success clears it, so a worker started after the lobby re-enables
 * online play without a reload.
 */
let everSucceeded = false;
let down = false;
const downListeners = new Set<() => void>();
function setDown(next: boolean) {
  if (next === down) return;
  down = next;
  for (const listener of [...downListeners]) listener();
}
let timer: number | null = null;
let subscribers = 0;
let inFlight = false;
let nextDelayMs = POLL_INTERVAL_MS;
let onVisibility: (() => void) | null = null;

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
    everSucceeded = true;
    setDown(false);
    nextDelayMs = POLL_INTERVAL_MS;
  } catch {
    // Unknown, not zero. Keep whatever we last knew and back off.
    if (!everSucceeded) setDown(true);
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
  // A read that lands after the last unsubscribe must not re-arm the loop.
  if (subscribers === 0) return;
  timer = window.setTimeout(() => {
    timer = null;
    void poll(game).then(() => schedule(game));
  }, nextDelayMs);
}

function acquire(game: string) {
  subscribers += 1;
  if (subscribers > 1) return;
  nextDelayMs = POLL_INTERVAL_MS;
  onVisibility = () => {
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
  if (onVisibility) {
    document.removeEventListener("visibilitychange", onVisibility);
    onVisibility = null;
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

const subscribeDown = (listener: () => void) => {
  downListeners.add(listener);
  return () => {
    downListeners.delete(listener);
  };
};
const getDownSnapshot = () => down;

export function usePlayerCount(
  enabled: boolean,
  game: string = GAME_ID,
  /**
   * Poll even when no URL is configured, against the localhost default.
   * The lobby passes true so a missing local relay reads as unreachable
   * instead of silently enabled; every other caller keeps the default.
   */
  probeUnconfigured = false,
): { count: PlayerCount | null; refresh: () => void; serverDown: boolean } {
  const live = enabled && (MATCHMAKING_CONFIGURED || probeUnconfigured);

  useEffect(() => {
    if (!live) return;
    acquire(game);
    return () => release();
  }, [live, game]);

  const count = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const downSnapshot = useSyncExternalStore(subscribeDown, getDownSnapshot, getDownSnapshot);
  const refresh = useCallback(() => {
    if (live) void poll(game);
  }, [live, game]);

  return { count: live ? count : null, refresh, serverDown: live ? downSnapshot : false };
}