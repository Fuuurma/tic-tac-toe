import type { GameState } from "@/game/logic";
import type { PeerSide, PlayerSymbol } from "@/game/constants";

/**
 * The room protocol's state vocabulary.
 *
 * These lived in `hooks/usePeerRoom.ts`, which is how the protocol modules
 * ended up importing *types* from a React hook — the type graph then said the
 * protocol depended on the hook, when the dependency is the other way round.
 * The hook keeps re-exporting them so its callers are untouched.
 */

export type PeerRole = PeerSide | null;

export type PeerStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

/**
 * Where a Quick Match is in the queue, independent of `status`.
 *
 * `status` cannot say it: a searcher polling the queue and a paired host
 * building its room both hold `creating`. `searching` is "in line, nobody
 * yet", `matched` is "paired, the room is being set up", `none` is anything
 * else (not a quick match, cancelled, expired, failed). The search UI and the
 * play-while-you-wait handoff key on this, never on message copy.
 */
export type QueueStage = "none" | "searching" | "matched";

export interface PeerRoomState {
  role: PeerRole;
  status: PeerStatus;
  queue: QueueStage;
  roomId: string;
  hostSymbol: PlayerSymbol | null;
  guestSymbol: PlayerSymbol | null;
  message: string;
  /**
   * F590: the message a host pause replaced. The pause frame shows
   * "Your host paused the game" so a stopped clock is legible, but a live
   * notice (rematch prompt, error text) is stashed here and restored on
   * resume instead of being destroyed. `null` when nothing is stashed.
   */
  pausedStash: string | null;
  /**
   * True while a host rematch request is pending on the guest. This is
   * the source of truth for rematch-prompt UI — never derive it by
   * matching user-facing message copy with a regex.
   */
  rematchIncoming: boolean;
  /**
   * True while this client (host) has issued a rematch request the guest
   * has not answered yet. Source of truth for the host's cancel UI —
   * mirrors rematchPendingRef as renderable state.
   */
  rematchOutgoing: boolean;
  /**
   * True once THIS client left the room, until the next room entry.
   *
   * The disconnect handler lets a terminal relay reason (the peer-left line)
   * outrank the transport's generic message, and it needs a durable way to
   * tell "we disconnected because we left" from "the relay told us why". It
   * used to compare `message` against the English literal "You left", which
   * silently stopped matching under any other locale — the message is display
   * copy and translated, so it cannot carry behaviour.
   */
  leftBySelf: boolean;
  gameState: GameState;
}

