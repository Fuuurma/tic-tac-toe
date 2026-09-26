import {
  GameStatus,
  GameModes,
  PlayerSymbol,
  oppositeSymbol,
  randomPlayerSymbol,
} from "@/game/constants";
import { createInitialGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { applyAuthorizedMove, applyHostGuestJoin, toWireGameState } from "@/lib/peer";
import type { PeerMessage } from "@/lib/peer";
import type { RoomClient } from "@/lib/room";
import type { PeerRoomState, PendingPlayerSettings } from "../usePeerRoom";

/**
 * Host-side game protocol, extracted from usePeerRoom (god-hook
 * decomposition, slice 2).
 *
 * The host is the game's authority: it validates every guest move
 * (`applyAuthorizedMove`), assigns symbols, gates rematch acceptance
 * behind a pending host request + terminal game, and wins by forfeit
 * when the guest leaves. Messages the host receives arrive via
 * `handleHostData` (routed by role in buildRoomClient).
 */
export interface HostProtocolDeps {
  stateRef: { current: GameState };
  roomRef: { current: RoomClient | null };
  hostSymbolRef: { current: PlayerSymbol | null };
  hostRematchPendingRef: { current: boolean };
  hostPendingSettingsRef: { current: PendingPlayerSettings | null };
  setState: React.Dispatch<React.SetStateAction<PeerRoomState>>;
  commitHostState: (gameState: GameState) => void;
  broadcastGameState: (gameState: GameState) => void;
  stopTimer: () => void;
  clearRematchTimeout: () => void;
}

export function applyHostMove(deps: HostProtocolDeps, index: number, actor: PlayerSymbol) {
  const { stateRef, roomRef, hostSymbolRef, commitHostState } = deps;
  {
    const current = stateRef.current;
    const next = applyAuthorizedMove(current, index, actor);
    if (!next) {
      // Only the guest's failed moves get a wire error — it drives the
      // guest's optimistic-move rollback (F159). The host's own moves are
      // validated locally and never need one. No null special-case: every
      // caller already rejects an unassigned hostSymbol before dispatching
      // here, and a real actor symbol never equals a null ref anyway, so
      // the error would still go out and the guest would roll back rather
      // than diverge (F160 — the old `hostSymbol === null` early-return
      // was unreachable dead code).
      if (actor !== hostSymbolRef.current) {
        roomRef.current?.send({ type: "error", message: "Invalid move" });
      }
      return;
    }
    // makeMove already sets turnTimeRemaining to a full TURN_DURATION_MS
    // for the next player — no override needed (devin 09-07 finding 5).
    commitHostState(next);
  }
}

/**
 * Handles one peer message addressed to the host (routed by role in
 * buildRoomClient).
 */
export function handleHostMessage(deps: HostProtocolDeps, message: PeerMessage) {
  const {
    stateRef,
    roomRef,
    hostSymbolRef,
    hostRematchPendingRef,
    hostPendingSettingsRef,
    setState,
    stopTimer,
    clearRematchTimeout,
  } = deps;
  {
    if (message.type === "join") {
      // hostSymbolRef is assigned synchronously in startAsHost; a null
      // here means the room was never initialized — tell the guest the
      // room isn't ready instead of dropping the join silently (F159:
      // a silent drop leaves the guest waiting on `joined` forever).
      const hostSymbol = hostSymbolRef.current;
      if (hostSymbol === null) {
        roomRef.current?.send({ type: "error", message: "Room not ready" });
        return;
      }
      const result = applyHostGuestJoin(stateRef.current, hostSymbol, {
        displayName: message.displayName,
        preferredColor: message.preferredColor,
      });
      stateRef.current = result.gameState;
      // Send the WIRE payload (deadline stripped, fresh remaining) — the
      // host state keeps its own deadline for turn expiry (fleet 09-08
      // devin report: this send site had shipped the stale state).
      const wireGameState = result.wireGameState;
      roomRef.current?.send({
        type: "joined",
        symbol: result.guestSymbol,
        color: result.guestColor,
        gameState: wireGameState,
      });
      roomRef.current?.send(
        result.kind === "accepted"
          ? { type: "gameStart", symbol: result.guestSymbol, gameState: wireGameState }
          : { type: "gameUpdate", gameState: wireGameState },
      );
      if (result.kind === "accepted") {
        setState((prev) => ({
          ...prev,
          status: "connected",
          guestSymbol: result.guestSymbol,
          gameState: result.gameState,
          message: "",
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: "connected",
          guestSymbol: result.guestSymbol,
          gameState: result.gameState,
        }));
      }
      return;
    }
    if (message.type === "move") {
      const hostSymbol = hostSymbolRef.current;
      // A null ref means the room was never initialized — send "Invalid
      // move" so the guest rolls back its optimistic move instead of
      // diverging on a silent drop (F159).
      if (hostSymbol === null) {
        roomRef.current?.send({ type: "error", message: "Invalid move" });
        return;
      }
      const guestSymbol = oppositeSymbol(hostSymbol);
      applyHostMove(deps, message.index, guestSymbol);
      return;
    }
    if (message.type === "rematchAccept") {
      const state = stateRef.current;
      // Two gates:
      // 1. The host must have issued a rematch request that's still pending.
      //    A stray guest message without a pending request is ignored.
      // 2. The current game must already be terminal — we never reset a
      //    game that's still in progress, even if both sides agree.
      if (
        !hostRematchPendingRef.current ||
        state.winner === null ||
        state.gameStatus !== GameStatus.COMPLETED
      ) {
        return;
      }
      hostRematchPendingRef.current = false;
      clearRematchTimeout();
      const newHostSymbol: PlayerSymbol = randomPlayerSymbol();
      const newGuestSymbol = oppositeSymbol(newHostSymbol);
      // Read BOTH player configs from the OLD state BEFORE overwriting
      // hostSymbolRef — when symbols swap, indexing by the NEW symbol
      // would give each side the other player's name/color/shape
      // (fleet critic 2026-09-06 P1). A null ref means the room was never
      // initialized — tell the guest instead of leaving it thinking the
      // rematch went through (F159).
      const oldHostSymbol = hostSymbolRef.current;
      if (oldHostSymbol === null) {
        roomRef.current?.send({ type: "error", message: "Room not ready" });
        return;
      }
      const hostPlayer = state.players[oldHostSymbol];
      const guestPlayer = state.players[oppositeSymbol(oldHostSymbol)];
      hostSymbolRef.current = newHostSymbol;
      // If the host edited their identity mid-game via the edit button,
      // pull that into the next match instead of keeping the previous one.
      const pending = hostPendingSettingsRef.current;
      const hostName = pending?.displayName ?? hostPlayer.username;
      const hostColor = pending?.color ?? hostPlayer.color;
      const hostShape = pending?.playerShape ?? hostPlayer.shape;
      if (pending) hostPendingSettingsRef.current = null;
      const reset = createInitialGameState({
        gameMode: GameModes.ONLINE,
        playerXName: newHostSymbol === PlayerSymbol.X ? hostName : guestPlayer.username,
        playerOName: newHostSymbol === PlayerSymbol.O ? hostName : guestPlayer.username,
        playerColor: hostColor,
        opponentColor: guestPlayer.color,
        playerShape: hostShape,
        opponentShape: guestPlayer.shape,
        humanSymbol: newHostSymbol,
      });
      stateRef.current = reset;
      setState((prev) => ({
        ...prev,
        hostSymbol: newHostSymbol,
        guestSymbol: newGuestSymbol,
        gameState: reset,
        message: "",
        rematchOutgoing: false,
      }));
      // gameStart alone carries the reset + the swapped guest symbol —
      // a gameUpdate alongside it duplicated the same state on the wire
      // and was applied twice by the guest's shared handler branch
      // (fleet brief 62c86d31).
      roomRef.current?.send({ type: "gameStart", symbol: newGuestSymbol, gameState: toWireGameState(reset) });
      return;
    }
    if (message.type === "rematchDecline") {
      // F254: mirror rematchAccept's pending gate — a stray decline with no
      // outstanding request must not stamp "Rematch declined" over live UI.
      if (!hostRematchPendingRef.current) return;
      hostRematchPendingRef.current = false;
      clearRematchTimeout();
      setState((prev) => ({ ...prev, message: "Rematch declined", rematchOutgoing: false }));
      return;
    }
    if (message.type === "leave") {
      stopTimer();
      hostRematchPendingRef.current = false;
      clearRematchTimeout();
      const state = stateRef.current;
      // Host wins by forfeit when the guest leaves (unless the game
      // already had a winner). Symbols randomize per rematch — prefer
      // the live ref, fall back to the state-recorded symbol, and crown
      // nobody rather than guess X/O when neither is known yet.
      setState((prev) => {
        const hostSymbol = hostSymbolRef.current ?? prev.hostSymbol;
        const ended: GameState =
          state.winner || hostSymbol === null
            ? state
            : {
                ...state,
                winner: hostSymbol,
                gameStatus: GameStatus.COMPLETED,
              };
        stateRef.current = ended;
        return {
          ...prev,
          status: "disconnected" as const,
          gameState: ended,
          message: "Opponent left",
          rematchOutgoing: false,
        };
      });
      return;
    }
    // NOTE: the host never receives {type:"error", message:"Invalid
    // move"} — the host SENDS it. The rollback branch for that message
    // lives in guestProtocol.ts (fleet critic 2026-09-06: it was
    // misplaced here, making the guest rollback dead code).
  }
}