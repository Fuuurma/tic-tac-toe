import { GAME_ID } from "@/game/constants";
import {
  buildRoomWsUrl,
  findMatch,
  getMatchPollDelay,
  leaveMatch,
  pollMatch,
  type MatchmakingResponse,
} from "@/lib/matchmaking";
import { getOrCreateGuestIdentity } from "@/lib/identity";
import type { PeerRoomState } from "../usePeerRoom";

/**
 * Quick-match controller, extracted from usePeerRoom (god-hook
 * decomposition, slice 3).
 *
 * Owns the matchmaking ticket lifecycle: join → poll the ticket until
 * paired (bounded at 2 minutes) → `startAsHost` binds the room only after
 * the service reports `matched`, or direct join when the service returns
 * an instant match. Binding before pairing is what 89ba965 removed; the
 * late bind is the invariant, not an oversight. `abandonTicket` is the
 * shared cleanup for user-leave and unmount; it also retires the live
 * attempt so that any continuation still awaiting a network call sees it
 * is no longer current and writes nothing.
 */
export interface MatchmakingDeps {
  matchmakingTicketRef: { current: string | null };
  hasStartedRef: { current: boolean };
  stopTimer: () => void;
  /** Status patcher (the hook's `update`). */
  setStatus: (patch: Partial<PeerRoomState>) => void;
  /** The hook's raw setState — needed for the keep-or-patch pattern. */
  patchStatus: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  hostDisplayName: string;
  startAsHost: (roomId?: string, wsUrl?: string, slotToken?: string) => void;
  joinAsGuest: (roomId: string, wsUrl?: string, slotToken?: string) => void;
  /** F738 follow-up: the mode flag must come from the caller — a matched
   *  response whose slotToken is absent (older Worker, race) would
   *  otherwise derive quickMatchHostRef=false from Boolean(undefined) and
   *  silently disarm the absent-peer deadline for a real quick-match
   *  host. */
  markQuickMatchHost: () => void;
  /** Test seam: shrink the 2-minute quick-match poll ceiling. */
  maxPollMs?: number;
}

const MAX_POLL_MS = 120_000;

/**
 * Identity of the live attempt, keyed by the ticket ref object (one per
 * hook instance). An attempt is current only while the map still holds the
 * token it was issued; `abandonTicket` deletes it. A retired attempt
 * (cancelled, unmounted, or superseded) never writes shared state and only
 * best-effort releases a ticket it personally obtained.
 */
const liveAttempts = new WeakMap<object, symbol>();

/**
 * Fire-and-forget ticket cancellation. Logs (doesn't swallow) a
 * rejection: a silent `.catch(() => {})` here would hide a real
 * Worker-side leak. Not surfaced to the UI — the match attempt is
 * already over by the time this runs.
 *
 * Also retires the live attempt, so cancelling (leave/unmount) invalidates
 * an attempt that is still awaiting findMatch or pollMatch.
 */
export function abandonTicket(
  deps: Pick<MatchmakingDeps, "matchmakingTicketRef">,
  label: string,
) {
  liveAttempts.delete(deps.matchmakingTicketRef);
  const ticket = deps.matchmakingTicketRef.current;
  if (ticket) {
    deps.matchmakingTicketRef.current = null;
    leaveMatch(GAME_ID, ticket).catch((err) => {
      console.error(`Matchmaking leave failed ${label}:`, (err as Error).message);
    });
  }
}

/** Runs the full quick-match attempt. No-op while one is in flight. */
export async function runQuickMatch(deps: MatchmakingDeps) {
  const {
    matchmakingTicketRef,
    hasStartedRef,
    stopTimer,
    setStatus,
    patchStatus,
    hostDisplayName,
    startAsHost,
    joinAsGuest,
    markQuickMatchHost,
    maxPollMs: maxPollMsArg,
  } = deps;
  if (hasStartedRef.current) return;
  hasStartedRef.current = true;
  const attempt = Symbol("quick-match-attempt");
  liveAttempts.set(matchmakingTicketRef, attempt);
  const isCurrent = () => liveAttempts.get(matchmakingTicketRef) === attempt;
  stopTimer();
  setStatus({ status: "creating", message: "Finding match…", queuePosition: null });

  // Cancel-on-disconnect: if the tab closes mid-queue, a keepalive
  // leave drops the ticket on the Worker now instead of leaking it
  // until the service-side sweep. `pagehide` (not `beforeunload`) is
  // the reliable teardown event; guarded for non-DOM test envs. Only the
  // live attempt may release the shared ticket.
  const cancelTicketOnUnload = () => {
    if (!isCurrent()) return;
    liveAttempts.delete(matchmakingTicketRef);
    const ticket = matchmakingTicketRef.current;
    matchmakingTicketRef.current = null;
    hasStartedRef.current = false;
    setStatus({
      status: "error",
      message: "Quick Match ended while this page was away. Try again or go back to setup.",
      queuePosition: null,
    });
    if (ticket) {
      leaveMatch(GAME_ID, ticket, undefined, { keepalive: true }).catch((err) => {
        console.error("Matchmaking leave failed on unload:", (err as Error).message);
      });
    }
  };
  const canListen = typeof window !== "undefined";

  try {
    // Identity/session setup can fail (for example, if secure random UUID
    // generation is unavailable). Keep it inside the attempt's cleanup path
    // so the start flag and live-attempt token do not remain wedged.
    const identity = getOrCreateGuestIdentity();
    const sessionId = crypto.randomUUID();
    if (canListen) window.addEventListener("pagehide", cancelTicketOnUnload);

    const response: MatchmakingResponse = await findMatch({
      game: GAME_ID,
      peerId: sessionId,
      displayName: hostDisplayName,
      guestId: identity.guestId,
    });

    if (!isCurrent()) {
      // Cancelled while the join was in flight: the service may already
      // have queued or paired us. Never host a room or touch shared state
      // for a retired attempt; release the ticket this attempt obtained.
      if (response.status === "waiting") {
        leaveMatch(GAME_ID, response.ticket, undefined, { keepalive: true }).catch((err) => {
          console.error("Matchmaking leave failed after cancel:", (err as Error).message);
        });
      }
      return;
    }

    if (response.status === "waiting") {
      matchmakingTicketRef.current = response.ticket;
      // FIFO queue position, when the Worker reports it — the searching
      // UI shows "position N" instead of a bare spinner.
      setStatus({ queuePosition: response.position ?? null });

      // Poll the matchmaking service until the guest is paired.
      // Bounded by a max duration and the user's ability to cancel
      // via leave() (which retires this attempt).
      const pollStart = Date.now();
      const maxPollMs = maxPollMsArg ?? MAX_POLL_MS;
      let pollAttempt = 0;
      let consecutiveFailures = 0;
      let matched = false;
      // A nil ref is also a cancel: leave() clears it directly on some paths.
      while (isCurrent() && matchmakingTicketRef.current && Date.now() - pollStart < maxPollMs) {
        try {
          const pollResponse = await pollMatch(GAME_ID, response.ticket);
          if (!isCurrent()) break; // cancelled while the poll was in flight
          consecutiveFailures = 0;
          if (pollResponse.status === "matched") {
            matched = true;
            markQuickMatchHost();
            startAsHost(
              response.roomId,
              buildRoomWsUrl(response.roomId),
              pollResponse.slotToken,
            );
            break;
          }
          setStatus({ queuePosition: pollResponse.position ?? null });
        } catch (err) {
          if (!isCurrent()) break;
          // A transient network error must not abort the whole
          // quick-match attempt (fleet 2026-09-06): count consecutive
          // failures and keep backing off; bail only when the service
          // is persistently unreachable.
          consecutiveFailures += 1;
          console.warn(
            `Matchmaking poll failed (${consecutiveFailures}):`,
            (err as Error).message,
          );
          if (consecutiveFailures >= 5) throw err;
        }
        const delay = getMatchPollDelay(pollAttempt);
        pollAttempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Retired while polling (user leave/unmount): the cancel path already
      // released the ticket and owns the UI state. Nothing more to do here.
      if (!isCurrent()) return;
      const userCancelled = !matched && matchmakingTicketRef.current === null;

      if (matched) {
        // The poll consumed the ticket — the guest is on their way to
        // our host room. Firing leaveMatch for a consumed ticket either
        // 404s or risks tearing down the pairing (fleet 2026-09-07),
        // so just drop the ref and retire the attempt.
        liveAttempts.delete(matchmakingTicketRef);
        matchmakingTicketRef.current = null;
      } else {
        abandonTicket(deps, "after poll");
      }
      hasStartedRef.current = false;

      // Polling ran out of time without a match. Surface an error so the
      // user isn't left in "waiting" forever.
      if (!matched && !userCancelled) {
        patchStatus((prev) =>
          prev.status === "waiting" || prev.status === "creating"
            ? {
                ...prev,
                status: "error",
                message: "No opponent found after 2 minutes. Try again, or create a room to invite someone.",
              }
            : prev,
        );
      }
      return;
    }

    if (response.status === "matched") {
      liveAttempts.delete(matchmakingTicketRef);
      matchmakingTicketRef.current = null;
      hasStartedRef.current = false;
      joinAsGuest(response.match.roomId, response.match.wsUrl, response.slotToken);
      return;
    }
  } catch (err) {
    // A retired attempt reports nothing: its cancel path already settled
    // the ticket and the UI.
    if (!isCurrent()) return;
    // Best-effort ticket release: when the failure was partial (poll route
    // erroring while the service stays up) the ticket is still queued
    // server-side — a leave frees it; when the service is truly unreachable
    // the leave fails harmlessly (bounded, logged). abandonTicket no-ops on
    // a nil ref, so the user-cancel path still single-fires via leave().
    abandonTicket(deps, "after error");
    hasStartedRef.current = false;
    setStatus({
      status: "error",
      message: `Matchmaking failed: ${(err as Error).message}`,
      queuePosition: null,
    });
  } finally {
    if (canListen) window.removeEventListener("pagehide", cancelTicketOnUnload);
  }
}
