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
 * Owns the matchmaking ticket lifecycle: join → host room + poll loop
 * (bounded at 2 minutes, cancellable via `leave()` nil-ing the ticket
 * ref) or direct join when the service returns an instant match.
 * `abandonTicket` is the shared cleanup for user-leave and unmount.
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
  startAsHost: (roomId?: string, wsUrl?: string) => void;
  joinAsGuest: (roomId: string, wsUrl?: string) => void;
}

const MAX_POLL_MS = 120_000;

/**
 * Fire-and-forget ticket cancellation. Logs (doesn't swallow) a
 * rejection: a silent `.catch(() => {})` here would hide a real
 * Worker-side leak. Not surfaced to the UI — the match attempt is
 * already over by the time this runs.
 */
export function abandonTicket(
  deps: Pick<MatchmakingDeps, "matchmakingTicketRef">,
  label: string,
) {
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
  } = deps;
  if (hasStartedRef.current) return;
  hasStartedRef.current = true;
  stopTimer();
  setStatus({ status: "creating", message: "Finding match…" });
  const identity = getOrCreateGuestIdentity();
  const sessionId = crypto.randomUUID();
  try {
    const response: MatchmakingResponse = await findMatch({
      game: GAME_ID,
      peerId: sessionId,
      displayName: hostDisplayName,
      guestId: identity.guestId,
    });

    if (response.status === "waiting") {
      matchmakingTicketRef.current = response.ticket;
      const wsUrl = buildRoomWsUrl(response.roomId, GAME_ID);
      startAsHost(response.roomId, wsUrl);

      // Poll the matchmaking service until the guest is paired.
      // Bounded by a max duration and the user's ability to cancel
      // via leave() (which clears the ticket ref).
      const pollStart = Date.now();
      let pollAttempt = 0;
      let consecutiveFailures = 0;
      let matched = false;
      while (Date.now() - pollStart < MAX_POLL_MS) {
        if (!matchmakingTicketRef.current) break; // user cancelled via leave()
        try {
          const pollResponse = await pollMatch(GAME_ID, response.ticket);
          consecutiveFailures = 0;
          if (pollResponse.status === "matched") {
            matched = true;
            break;
          }
        } catch (err) {
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

      // Did the user cancel via leave() while we were polling?
      const userCancelled = matchmakingTicketRef.current === null;
      abandonTicket(deps, "after poll");
      hasStartedRef.current = false;

      // If the polling timed out without a match and the user didn't
      // cancel, surface an error so they aren't left in "waiting"
      // forever. The host room stays open — the user can share the
      // code manually or exit.
      if (!matched && !userCancelled) {
        patchStatus((prev) =>
          prev.status === "waiting" || prev.status === "creating"
            ? {
                ...prev,
                status: "error",
                message: "No opponent found after 2 minutes. Try again or share your room code.",
              }
            : prev,
        );
      }
      return;
    }

    if (response.status === "matched") {
      matchmakingTicketRef.current = null;
      hasStartedRef.current = false;
      joinAsGuest(response.match.roomId, response.match.wsUrl);
      return;
    }
  } catch (err) {
    matchmakingTicketRef.current = null;
    hasStartedRef.current = false;
    setStatus({ status: "error", message: `Matchmaking failed: ${(err as Error).message}` });
  }
}
