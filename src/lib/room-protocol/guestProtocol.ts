import { rebuildDeadline } from "@/game/turnClock";
import { GameStatus, PlayerSymbol } from "@/game/constants";
import { isGameActive } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { t } from "@/i18n/language";
import { type PeerMessage } from "@/lib/peer.wire";
import { applyForfeitIfActive } from "@/lib/peer.apply";
import type { PeerRoomState } from "./state";

/** Guest-facing notice while the host's clock is frozen (5b76d7b). */
// Localised at each use site (never stored): the pause notice must read
// the same value everywhere it is compared and set. A language switch
// mid-pause leaves the old notice up until the next frame — harmless.

/**
 * Guest-side game protocol, extracted from usePeerRoom (god-hook
 * decomposition, slice 3).
 *
 * The guest treats the host as authoritative: `joined`/`gameStart`/
 * `gameUpdate` snapshots replace local state (and clear the optimistic
 * rollback snapshot), rematch prompts are display-only, and a host
 * `leave` ends the game with the guest as winner by forfeit.
 */
export interface GuestProtocolDeps {
  stateRef: { current: GameState };
  guestSymbolRef: { current: PlayerSymbol | null };
  /** Optimistic-move rollback snapshot; cleared ONLY on an
   *  authoritative host update (never in the ref-sync effect). */
  pendingGuestStateRef: { current: GameState | null };
  /** True while THIS guest has an unanswered rematch request out. The host
   *  gates its prompt on the same flag, so without it here both sides can
   *  prompt at once and each waits 30s on the other. */
  rematchPendingRef: { current: boolean };
  /** True while THIS guest has a sync_request out and no snapshot answered
   *  it yet. Only a solicited state_snapshot may overwrite a live game; an
   *  unsolicited one (a stale or hostile frame) must not clobber play. */
  syncPendingRef: { current: boolean };
  /** Cancels this guest's rematch-expiry timer. */
  clearRematchTimeout: () => void;
  /**
   * Applies the host's pause to this guest's own clock. Separate from the
   * local `setPaused` because a guest must never REBUILD its deadline from
   * the frozen value — its real deadline stayed truthful while the host's
   * clock was stopped, so rebuilding would overstate the remaining time by
   * the whole pause (F226). Freezing only stops the display draining.
   */
  onHostPause: (paused: boolean) => void;
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  stopTimer: () => void;
}

/**
 * Handles one peer message addressed to the guest (routed by role in
 * buildRoomClient).
 */
export function handleGuestMessage(deps: GuestProtocolDeps, message: PeerMessage) {
  const {
    stateRef,
    guestSymbolRef,
    pendingGuestStateRef,
    rematchPendingRef,
    syncPendingRef,
    clearRematchTimeout,
    setState,
    stopTimer,
  } = deps;
  {
    if (message.type === "joined" || message.type === "gameStart" || message.type === "gameUpdate" || message.type === "state_snapshot") {
      // F618: a snapshot is only applied when this guest asked for one
      // (reconnect resync). An unsolicited snapshot must not overwrite a
      // live board. A solicited one is consumed here, so a duplicate or
      // late second snapshot is ignored.
      if (message.type === "state_snapshot") {
        if (!syncPendingRef.current) return;
        syncPendingRef.current = false;
      }
      // F610: a gameStart mid-play (ACTIVE with moves already made) is a
      // stale or hostile frame; applying it would wipe the live game. Join
      // gameStarts arrive from WAITING, and rematch gameStarts arrive after
      // a terminal game, so both still apply.
      if (
        message.type === "gameStart" &&
        isGameActive(stateRef.current) &&
        stateRef.current.moveCount > 0
      ) {
        return;
      }
      // Anchor the deadline to THIS clock: the wire state carries only
      // `turnTimeRemaining` (toWireGameState strips the host's absolute
      // deadline), so `now + remaining` is skew-free. A deadline that does
      // arrive (older/hostile peer) is still host-clock — ignore it and
      // synthesize the same way.
      const gameState = isGameActive(message.gameState)
        ? {
            ...message.gameState,
            turnDeadlineAt: rebuildDeadline(
              message.gameState.turnTimeRemaining,
              Date.now(),
            ),
          }
        : message.gameState;
      // Capture the rollback snapshot BEFORE clearing it. The host cannot
      // send an `error` (the relay reserves that type and bounces it back to
      // the sender), so it resyncs with a plain authoritative update instead.
      // An update whose moveCount still equals the pre-move snapshot means
      // the host rejected our optimistic move — say so, rather than letting
      // the mark silently vanish.
      const pending = pendingGuestStateRef.current;
      const moveRejected =
        pending !== null && pending.moveCount === message.gameState.moveCount;
      const assignedSymbol = "symbol" in message ? message.symbol : undefined;
      stateRef.current = gameState;
      // An authoritative state update supersedes any pending optimistic
      // move, so clear the rollback snapshot. This is the ONLY place we
      // clear it — the ref-sync effect does NOT clear it because that
      // effect also fires on the guest's own optimistic move.
      pendingGuestStateRef.current = null;
      // joined/gameStart assign the guest's symbol; snapshots carry it when
      // available, while legacy snapshots preserve the previous assignment.
      if (assignedSymbol) {
        guestSymbolRef.current = assignedSymbol;
      }
      // A new game supersedes any request of ours that is still out: the
      // host answering it IS the accept. Leaving the flag set would make the
      // guest cancel a request nobody is waiting on, and block it from
      // asking for a third game until the 30s expiry fired.
      if (message.type === "gameStart") {
        rematchPendingRef.current = false;
        clearRematchTimeout();
      }
      setState((prev) => {
        const localSymbol = assignedSymbol ?? prev.guestSymbol;
        return {
          ...prev,
          status: "connected",
          gameState,
          guestSymbol: localSymbol,
          message: moveRejected ? t("peer.moveRejected") : "",
          rematchOutgoing: message.type === "gameStart" ? false : prev.rematchOutgoing,
          // A terminal frame (state_snapshot/joined resync on a finished
          // game) does not supersede a live rematch prompt — only a new
          // ACTIVE game does (review 2026-10-03 P3).
          rematchIncoming: isGameActive(gameState) ? false : prev.rematchIncoming,
        };
      });
      return;
    }
    if (message.type === "rematchRequested") {
      const state = stateRef.current;
      // F191: mirror the host-side accept gate — a rematch prompt is only
      // meaningful on a terminal game. A mid-game request from a hostile
      // or buggy host must not pop the prompt over live play.
      if (state.winner === null || state.gameStatus !== GameStatus.COMPLETED) return;
      // Mirror the host's own pending gate (hostProtocol rematchRequested):
      // only one request may be in flight. Without this, a mutual ask leaves
      // both sides showing a prompt plus a "waiting for opponent" cancel,
      // each waiting 30s on the other with no way to settle it.
      if (rematchPendingRef.current) return;
      setState((prev) =>
        // A prompt already up is a no-op: answering one request and asking
        // another would leave both players waiting.
        prev.rematchIncoming
          ? prev
          : {
              ...prev,
              message: t("peer.wantsRematch", { name: state.players[message.requesterSymbol].username }),
              rematchIncoming: true,
            },
      );
      return;
    }
    if (message.type === "rematchCancel") {
      // Host withdrew a pending rematch request before the guest responded.
      // Clear the prompt so the guest UI no longer offers accept/decline.
      // Gate on the explicit rematchIncoming flag — never on the
      // user-facing message copy.
      setState((prev) =>
        prev.rematchIncoming
          ? { ...prev, message: t("peer.rematchWithdrawn"), rematchIncoming: false }
          : prev,
      );
      return;
    }
    if (message.type === "pause") {
      // The host froze the clock. Stop counting down (the countdown racing
      // to 0 against a stopped clock read as the game having expired) and
      // say why, so a refused move is legible rather than a mark that simply
      // disappears. The host is authoritative here; a guest cannot move the
      // host's clock with this frame.
      deps.onHostPause(message.paused);
      setState((prev) => {
        if (message.paused) {
          // F590: stash a live notice instead of destroying it — a
          // rematch prompt or error text outlives the pause and comes
          // back on resume. An empty/already-paused message stashes
          // nothing (and a repeated pause frame keeps the stash).
          const live = prev.message !== "" && prev.message !== t("peer.hostPaused");
          return {
            ...prev,
            message: t("peer.hostPaused"),
            pausedStash: live ? prev.message : prev.pausedStash,
          };
        }
        // Resume clears only the pause notice (5b76d7b): restore the
        // stash if the pause text is still on screen, else leave
        // whatever a mid-pause frame wrote alone.
        return {
          ...prev,
          message:
            prev.message === t("peer.hostPaused")
              ? (prev.pausedStash ?? "")
              : prev.message,
          pausedStash: null,
        };
      });
      return;
    }
    if (message.type === "leave") {
      // Host explicitly left. The close event will follow, but we can
      // show a more specific message now.
      stopTimer();
      const current = stateRef.current;
      setState((prev) => {
        // Symbols randomize per rematch — prefer the live ref, fall back
        // to the state-recorded symbol, and crown nobody rather than
        // guess X/O when neither is known yet.
        const guestSymbol = guestSymbolRef.current ?? prev.guestSymbol;
        const gameState = applyForfeitIfActive(current, guestSymbol);
        stateRef.current = gameState;
        return {
          ...prev,
          status: "disconnected" as const,
          gameState,
          message: t("peer.hostLeft"),
          rematchIncoming: false,
        };
      });
      return;
    }
  }
}
