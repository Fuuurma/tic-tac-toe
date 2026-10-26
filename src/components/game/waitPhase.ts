import { GameStatus } from "@/game/constants";
import type { PeerRole, PeerStatus, QueueStage } from "@/hooks/usePeerRoom";

/**
 * Where a player stands before their online game exists.
 *
 * - `searching`: nobody yet. In the Quick Match queue, or a created room that
 *   is open and waiting for someone to arrive.
 * - `matched`: somebody is here and the game is being set up.
 * - `ended`: the wait is over without a game (search expired, room closed).
 *
 * `null` means there is no wait to show: the game exists, or nothing has
 * started. Play-while-you-wait, its strip and its handoff all key on this and
 * never on message copy.
 */
export type WaitPhase = "searching" | "matched" | "ended";

export interface WaitInput {
  action: "create" | "join" | "quick";
  role: PeerRole;
  status: PeerStatus;
  queue: QueueStage;
  gameStatus: GameStatus;
}

export function waitPhase({ action, role, status, queue, gameStatus }: WaitInput): WaitPhase | null {
  if (action === "quick") return quickPhase(status, queue);
  if (action === "create" && role === "host") return roomPhase(status, gameStatus);
  // A guest joins a host who is already there or fails fast; there is no
  // wait worth filling.
  return null;
}

/**
 * `queue` is the source of truth, because `status` cannot tell a searcher
 * from a paired host building its room (both hold `creating`).
 */
function quickPhase(status: PeerStatus, queue: QueueStage): WaitPhase | null {
  if (status === "connected" || status === "reconnecting" || status === "disconnected") {
    return null;
  }
  if (status === "error") return "ended";
  if (queue === "searching") return "searching";
  if (queue === "matched") return "matched";
  return null;
}

/**
 * A created room has no queue; its host moves through the connection states.
 * `peer-joined` writes `connecting` before the guest's own `join` frame
 * starts the game, which is the window the handoff overlay covers.
 */
function roomPhase(status: PeerStatus, gameStatus: GameStatus): WaitPhase | null {
  // Once play began, a dropped connection is the game's reconnect, not a wait.
  if (gameStatus !== GameStatus.WAITING) return null;
  switch (status) {
    case "waiting":
    case "reconnecting":
      // The room code keeps working through a reconnect.
      return "searching";
    case "connecting":
      return "matched";
    case "error":
    case "disconnected":
      return "ended";
    default:
      return null;
  }
}
