import {
  AVAILABLE_COLORS,
  Color,
  GameStatus,
  PlayerSymbol,
  PlayerTypes,
  TURN_DURATION_MS,
  oppositeSymbol,
  type PeerSide,
} from "@/game/constants";
import { isGameActive, isValidMove, makeMove, type GameState } from "@/game/logic";
import { sanitizeDisplayName } from "@/lib/identity";
import { t } from "@/i18n/language";
import { PEER_MAX_BOARD_INDEX, toWireGameState } from "@/lib/peer.wire";

/**
 * Applying a wire message to game state.
 *
 * Every function here is a pure transition: message in, new state out, no I/O.
 * The predicates that decide whether a message is *admissible* live in
 * `peer.wire.ts` — this module assumes it was already asked.
 */

export const chooseGuestColor = (preferred: Color | undefined, hostColor: Color): Color => {
  if (preferred && preferred !== hostColor) return preferred;
  return AVAILABLE_COLORS.find((color) => color !== hostColor) ?? Color.GRAY;
};

export const peerLeftUserMessage = (
  role: PeerSide,
  reason: "disconnect" | "closed" | "expired",
): string => {
  if (reason === "disconnect") {
    return role === "guest" ? t("peer.hostReconnecting") : t("peer.opponentReconnecting");
  }
  if (reason === "expired") {
    return role === "guest" ? t("peer.hostGone") : t("peer.opponentGone");
  }
  return role === "guest" ? t("peer.hostLeftRoom") : t("peer.opponentLeftRoom");
};

/**
 * Crown `survivor` only when a match was actually in progress.
 * A peer that drops during WAITING (joined then left, or never sat down)
 * must not mint a COMPLETED game — that writes a phantom win into local
 * stats (F146). Already-terminal games keep their recorded winner.
 *
 * A forfeit has no winning line, so `winningCombination` stays null. The
 * `forfeited` flag is what distinguishes this legitimate winner-without-a-line
 * from a peer claiming a win it never made (F404): without it the state this
 * function returns is rejected by `isGameState`, and any resync or snapshot
 * carrying it is silently dropped by the receiver — which strands a rejoining
 * guest waiting on a frame that will never validate.
 */
export const applyForfeitIfActive = (
  state: GameState,
  survivor: PlayerSymbol | null,
): GameState => {
  if (survivor === null || !isGameActive(state)) return state;
  return {
    ...state,
    winner: survivor,
    gameStatus: GameStatus.COMPLETED,
    forfeited: true,
  };
};

type HostGuestJoinResult = {
  kind: "accepted" | "resync";
  /** The HOST's live state — always keeps its own turnDeadlineAt. */
  gameState: GameState;
  /** The payload to SEND to the guest. On resync this strips the
   *  stored deadline (computed before any disconnect) and carries
   *  turnTimeRemaining instead, so the guest resynthesizes fresh. */
  wireGameState: GameState;
  guestSymbol: PlayerSymbol;
  guestColor: Color;
};

/** First join starts the match. Later joins (reconnect) resync without resetting. */
export const applyHostGuestJoin = (
  state: GameState,
  hostSymbol: PlayerSymbol,
  join: { displayName: string; preferredColor?: Color },
  now: number = Date.now(),
): HostGuestJoinResult => {
  const guestSymbol = oppositeSymbol(hostSymbol);
  if (state.gameStatus !== GameStatus.WAITING) {
    const guest = state.players[guestSymbol];
    // Resync (docs/DESIGN-resync-rollback): the stored deadline was
    // computed on the host clock before any disconnect, so a guest gone
    // for minutes would honor a stale/expired timer. Send the REMAINING
    // time instead — the guest's synthesis path (now +
    // turnTimeRemaining) always produces a fresh deadline.
    return {
      kind: "resync",
      gameState: state,
      wireGameState: toWireGameState(state, now),
      guestSymbol,
      guestColor: guest.color,
    };
  }

  const guestColor = chooseGuestColor(join.preferredColor, state.players[hostSymbol].color);
  const guestName = sanitizeDisplayName(join.displayName, t("peer.guestFallback"));
  const gameState: GameState = {
    ...state,
    gameStatus: GameStatus.ACTIVE,
    turnTimeRemaining: TURN_DURATION_MS,
    turnDeadlineAt: now + TURN_DURATION_MS,
    players: {
      ...state.players,
      [guestSymbol]: {
        username: guestName,
        color: guestColor,
        symbol: guestSymbol,
        shape: state.players[guestSymbol].shape,
        type: PlayerTypes.HUMAN,
        lastMoveAt: now,
      },
    },
  };
  return {
    kind: "accepted",
    gameState,
    wireGameState: toWireGameState(gameState, now),
    guestSymbol,
    guestColor,
  };
};

export const applyAuthorizedMove = (
  state: GameState,
  index: number,
  actor: PlayerSymbol,
): GameState | null => {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index > PEER_MAX_BOARD_INDEX ||
    !isValidMove(state, index, actor)
  ) {
    return null;
  }
  return makeMove(state, index);
};
