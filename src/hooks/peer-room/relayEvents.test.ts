import { describe, it, expect, vi } from "vitest";
import {
  GameStatus,
  PlayerSymbol,
  TURN_DURATION_MS,
} from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import { peerLeftUserMessage } from "@/lib/peer";
import type { RoomClient } from "@/lib/room";
import type { PeerRole } from "../usePeerRoom";
import type { PeerRoomState } from "../usePeerRoom";
import { handleRelayEvent, type RelayEventDeps } from "./relayEvents";

// Regression pins for the peer-reconnected state machine — the fleet's
// most-fixed surface (host deadline reset, guest resync, lobby stranding).

function activeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    ...freshGameState(),
    gameStatus: GameStatus.ACTIVE,
    moveCount: 2,
    turnTimeRemaining: 12_000,
    turnDeadlineAt: Date.now() - 60_000, // stale — deadline pre-disconnect
    ...overrides,
  };
}

function makeDeps(
  game: GameState,
  role: PeerRole,
  roomInit: Partial<PeerRoomState> = {},
) {
  let roomState = { gameState: game, ...roomInit } as PeerRoomState;
  const calls = { committed: [] as GameState[], broadcasts: [] as GameState[] };
  const deps: RelayEventDeps = {
    roomRef: { current: null },
    stateRef: { current: game },
    roleRef: { current: role },
    hostSymbolRef: { current: PlayerSymbol.X },
    guestSymbolRef: { current: PlayerSymbol.O },
    hostRematchPendingRef: { current: false },
    reconnectResetsRef: { current: { moveCount: -1 } },
    pausedRef: { current: false },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    commitHostState: (g) => {
      calls.committed.push(g);
      deps.stateRef.current = g; // mirrors the real hook — commit updates the ref
      roomState = { ...roomState, gameState: g };
      // ...and broadcasts: the real commitHostState ends in a wire send.
      deps.broadcastGameState(g);
    },
    broadcastGameState: (g) => void calls.broadcasts.push(g),
    requestSync: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
  };
  return { deps, calls, getRoom: () => roomState };
}

describe("handleRelayEvent peer-reconnected", () => {
  it("guest resynthesizes turnDeadlineAt from remaining time", () => {
    const game = activeGame();
    const { deps, getRoom } = makeDeps(game, "guest");
    const before = Date.now();

    handleRelayEvent(deps, { type: "peer-reconnected" });

    const next = deps.stateRef.current;
    expect(next.turnDeadlineAt).toBeGreaterThanOrEqual(before + 12_000);
    expect(next.turnDeadlineAt).toBeLessThanOrEqual(Date.now() + 12_000 + 500);
    expect(next.turnDeadlineAt).not.toBe(game.turnDeadlineAt);
    expect(getRoom().gameState).toBe(next);
    expect(deps.startTimer).toHaveBeenCalledOnce();
  });

  it("guest with inactive game does not resync the deadline", () => {
    const game = activeGame({ gameStatus: GameStatus.WAITING });
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(deps.stateRef.current).toBe(game);
    expect(deps.startTimer).not.toHaveBeenCalled();
    expect(deps.requestSync).not.toHaveBeenCalled();
  });

  it("guest peer-reconnected mid-game also pulls a snapshot (dropped host push)", () => {
    // peer-reconnected on the guest means the HOST came back — unlike a
    // fresh welcome there is no join resend mid-game (F252 covers only
    // WAITING), so the pull is the guest's catch-up if the host's
    // welcome broadcast was dropped.
    const game = activeGame();
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(deps.requestSync).toHaveBeenCalledOnce();
  });

  it("guest pulls on peer-reconnected when local is COMPLETED (missed rematch gameStart)", () => {
    // Review 2026-10-03 repair P2: a guest that thinks the game ended
    // but missed the host's rematch gameStart has no other catch-up —
    // gating the pull on local ACTIVE left it diverged exactly when the
    // COMPLETED-snapshot reply path exists to fix it.
    const game = activeGame({
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    });
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(deps.requestSync).toHaveBeenCalledOnce();
    // No deadline work on a terminal state — nothing resynthesized, no
    // clock restarted.
    expect(deps.stateRef.current).toBe(game);
    expect(deps.startTimer).not.toHaveBeenCalled();
  });

  it("F444: guest peer-reconnected while paused still resyncs + pulls, but the clock stays stopped", () => {
    // A guest with its own Settings/Help overlay open has the local
    // interval stopped and the display frozen — an ungated startTimer()
    // here drained the frozen remaining behind the overlay, the guest
    // side of the F288 pause bypass.
    const game = activeGame();
    const { deps } = makeDeps(game, "guest");
    deps.pausedRef.current = true;
    const before = Date.now();

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(deps.startTimer).not.toHaveBeenCalled();
    // The catch-up work still happens — the resynthesis and the pull are
    // what reconcile the guest once its overlay closes.
    expect(deps.requestSync).toHaveBeenCalledOnce();
    expect(deps.stateRef.current.turnDeadlineAt).toBeGreaterThanOrEqual(
      before + 12_000,
    );
  });

  it("host resets the deadline once per move and commits", () => {
    const game = activeGame();
    const { deps, calls } = makeDeps(game, "host");
    const before = Date.now();

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(calls.committed).toHaveLength(1);
    const committed = calls.committed[0];
    expect(committed.turnDeadlineAt).toBeGreaterThanOrEqual(
      before + TURN_DURATION_MS,
    );
    expect(committed.turnTimeRemaining).toBe(TURN_DURATION_MS);

    // Second reconnect on the SAME move keeps the remaining time —
    // the once-per-move bound stops a flapping peer from stalling.
    calls.committed.length = 0;
    handleRelayEvent(deps, { type: "peer-reconnected" });
    expect(calls.committed).toHaveLength(1);
    expect(calls.committed[0].turnDeadlineAt).toBe(committed.turnDeadlineAt);
  });

  it("F288: host peer-reconnected while paused commits the frozen state unchanged, no reset or timer", () => {
    const game = activeGame();
    const { deps, calls } = makeDeps(game, "host");
    deps.pausedRef.current = true;

    handleRelayEvent(deps, { type: "peer-reconnected" });

    // The paused path commits the unchanged state — the rejoining guest
    // still gets its catch-up — but nothing is rebuilt and no clock runs.
    // A regression that rebuilds the deadline lands a fresh object with
    // turnTimeRemaining === TURN_DURATION_MS here, so this stays red.
    expect(calls.committed).toHaveLength(1);
    expect(calls.committed[0]).toBe(game);
    expect(deps.startTimer).not.toHaveBeenCalled();
    expect(deps.stateRef.current.turnTimeRemaining).toBe(12_000);
    expect(deps.stateRef.current.turnDeadlineAt).toBe(game.turnDeadlineAt);
    expect(calls.broadcasts).toHaveLength(1);
    expect(calls.broadcasts[0]).toBe(game);
  });

  it("host peer-reconnected while unpaused still resets (negative pin)", () => {
    const game = activeGame();
    const { deps, calls } = makeDeps(game, "host");
    deps.pausedRef.current = false;

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(calls.committed).toHaveLength(1);
    expect(deps.startTimer).toHaveBeenCalledOnce();
    expect(calls.committed[0].turnTimeRemaining).toBe(TURN_DURATION_MS);
  });

  it("F456: host welcome-with-opponent on a terminal game broadcasts but starts no timer", () => {
    // The gate at the top of this branch is `isGameActive(current) &&
    // !pausedRef.current`, so a terminal game takes the broadcast else-branch.
    // The `startTimer()` that followed sat *outside* that gate and only checked
    // the pause flag — so an unpaused host reconnecting on a game-over screen
    // spawned a live interval for a game that has already finished. The peer
    // -reconnected twin a few lines down nests its `startTimer()` inside the
    // same `isGameActive` check; this one did not.
    const game = activeGame({
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    });
    const { deps, calls } = makeDeps(game, "host");
    deps.pausedRef.current = false;

    handleRelayEvent(deps, {
      type: "welcome",
      role: "host",
      opponent: { guestId: "g1", displayName: "Guest" },
    });

    // A terminal state has no live clock — the same invariant the guest branch
    // already states in a comment.
    expect(deps.startTimer).not.toHaveBeenCalled();

    // The catch-up must still happen — the unchanged state is committed,
    // which broadcasts on the wire. A plausible wrong fix is to gate the
    // else-branch too — "only send live games" — which satisfies the
    // assertion above while silently dropping the catch-up a rejoining
    // guest depends on. Verified: that variant turns this assertion red.
    expect(calls.committed).toHaveLength(1);
    expect(calls.committed[0]).toBe(game);
    expect(calls.broadcasts).toHaveLength(1);
    expect(calls.broadcasts[0]).toBe(game);
  });

  it("host welcome-with-opponent on an active unpaused game still starts the timer (negative pin)", () => {
    // The fix must not become "never start the timer here".
    const game = activeGame();
    const { deps, calls } = makeDeps(game, "host");
    deps.pausedRef.current = false;

    handleRelayEvent(deps, {
      type: "welcome",
      role: "host",
      opponent: { guestId: "g1", displayName: "Guest" },
    });

    expect(deps.startTimer).toHaveBeenCalledOnce();
    expect(calls.committed).toHaveLength(1);
  });

  it("F288: host welcome-with-opponent while paused commits the frozen state unchanged, no reset or timer", () => {
    const game = activeGame();
    const { deps, calls } = makeDeps(game, "host");
    deps.pausedRef.current = true;

    handleRelayEvent(deps, {
      type: "welcome",
      role: "host",
      opponent: { guestId: "g1", displayName: "Guest" },
    });

    expect(calls.committed).toHaveLength(1);
    expect(calls.committed[0]).toBe(game);
    expect(deps.startTimer).not.toHaveBeenCalled();
    expect(deps.stateRef.current.turnTimeRemaining).toBe(12_000);
    expect(deps.stateRef.current.turnDeadlineAt).toBe(game.turnDeadlineAt);
    expect(calls.broadcasts).toHaveLength(1);
    expect(calls.broadcasts[0]).toBe(game);
  });

  it("guest welcome mid-game emits sync_request (reconnect pull)", () => {
    const game = activeGame();
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, {
      type: "welcome",
      role: "guest",
      opponent: { guestId: "h", displayName: "Host" },
    });

    expect(deps.requestSync).toHaveBeenCalledOnce();
  });

  it("guest's first welcome (no live game) does not emit sync_request", () => {
    const game = activeGame({ gameStatus: GameStatus.WAITING });
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, { type: "welcome", role: "guest", opponent: null });

    expect(deps.requestSync).not.toHaveBeenCalled();
  });

  it("guest welcome while locally COMPLETED still pulls (missed rematch gameStart)", () => {
    // Same divergence as the peer-reconnected path: local terminal state
    // + host already rematched = the welcome pull is the only catch-up.
    const game = activeGame({
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    });
    const { deps } = makeDeps(game, "guest");

    handleRelayEvent(deps, {
      type: "welcome",
      role: "guest",
      opponent: { guestId: "h", displayName: "Host" },
    });

    expect(deps.requestSync).toHaveBeenCalledOnce();
  });

  it("peer-reconnected preserves a live rematch prompt (transient host blip)", () => {
    // The host's pending rematch request survives a socket drop, so the
    // guest's prompt must too — clearing it here made the guestProtocol
    // terminal-snapshot preserve dead code in the real flow (review
    // 2026-10-03 repair P2).
    const game = activeGame({
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    });
    const { deps, getRoom } = makeDeps(game, "guest", {
      rematchIncoming: true,
    });

    handleRelayEvent(deps, { type: "peer-reconnected" });

    expect(getRoom().status).toBe("connected");
    expect(getRoom().rematchIncoming).toBe(true);
  });

  it("peer-left disconnect preserves the prompt, terminal expired still clears it", () => {
    const game = activeGame({
      gameStatus: GameStatus.COMPLETED,
      winner: PlayerSymbol.X,
    });
    const { deps, getRoom } = makeDeps(game, "guest", {
      status: "connected",
      rematchIncoming: true,
    });

    handleRelayEvent(deps, { type: "peer-left", reason: "disconnect" });

    expect(getRoom().status).toBe("reconnecting");
    expect(getRoom().rematchIncoming).toBe(true);

    handleRelayEvent(deps, { type: "peer-left", reason: "expired" });

    expect(getRoom().status).toBe("disconnected");
    expect(getRoom().rematchIncoming).toBe(false);
  });

  it("peer-left expired clears the rematch deadline + pending flag", () => {
    const game = activeGame();
    const { deps } = makeDeps(game, "host");
    deps.hostRematchPendingRef.current = true;

    handleRelayEvent(deps, { type: "peer-left", reason: "expired" });

    expect(deps.hostRematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });
});

describe("handleRelayEvent symbol fallbacks", () => {
  it("host welcome derives the guest symbol from the live host symbol", () => {
    const game = activeGame();
    const { deps, getRoom } = makeDeps(game, "host", {
      hostSymbol: PlayerSymbol.O,
      guestSymbol: PlayerSymbol.X,
    });
    deps.hostSymbolRef.current = PlayerSymbol.O;

    handleRelayEvent(deps, {
      type: "welcome",
      role: "host",
      opponent: { guestId: "g1", displayName: "Guest" },
    });

    expect(getRoom().guestSymbol).toBe(PlayerSymbol.X);
  });

  it("host welcome keeps the recorded guestSymbol when no host symbol was ever assigned", () => {
    const game = activeGame();
    // Both the ref AND the recorded host symbol are null — the keep-branch
    // (`hostSymbol === null ? prev.guestSymbol : ...`) is the only thing
    // that can produce X here; a derive-off-a-default regression flips it.
    const { deps, getRoom } = makeDeps(game, "host", {
      hostSymbol: null,
      guestSymbol: PlayerSymbol.X,
    });
    deps.hostSymbolRef.current = null;
    deps.guestSymbolRef.current = null;

    handleRelayEvent(deps, {
      type: "welcome",
      role: "host",
      opponent: { guestId: "g1", displayName: "Guest" },
    });

    expect(getRoom().guestSymbol).toBe(PlayerSymbol.X);
    expect(getRoom().hostSymbol).toBeNull();
  });

  it("guest peer-left before symbol assignment crowns nobody", () => {
    const game = activeGame();
    const { deps, getRoom } = makeDeps(game, "guest", { guestSymbol: null });
    deps.guestSymbolRef.current = null;

    handleRelayEvent(deps, { type: "peer-left", reason: "closed" });

    expect(getRoom().status).toBe("disconnected");
    expect(getRoom().gameState.winner).toBeNull();
    expect(deps.stateRef.current.winner).toBeNull();
  });

  it("terminal peer-left message wins over close()'s synchronous 'You left' (needs-work 10-02 P1)", () => {
    const game = activeGame();
    const { deps, getRoom } = makeDeps(game, "host");
    const close = vi.fn();
    deps.roomRef.current = { close } as unknown as RoomClient;

    handleRelayEvent(deps, { type: "peer-left", reason: "closed" });

    // The relay's close() fires the status handler synchronously with
    // "You left" — the terminal peer-left state must be applied FIRST so
    // the survivor sees who left, not the leaver's own message.
    expect(getRoom().message).toBe(
      peerLeftUserMessage("host", "closed"),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("F234: terminal peer-left severs the socket so the relay's close can't reconnect", () => {
    const game = activeGame();
    const { deps } = makeDeps(game, "host");
    const close = vi.fn();
    deps.roomRef.current = { close } as unknown as RoomClient;

    handleRelayEvent(deps, { type: "peer-left", reason: "closed" });

    expect(close).toHaveBeenCalledOnce();
  });

  it("peer-left during WAITING does not crown a phantom winner (F146)", () => {
    const game = {
      ...freshGameState(),
      gameStatus: GameStatus.WAITING,
      moveCount: 0,
    };
    const { deps, getRoom } = makeDeps(game, "host", {
      hostSymbol: PlayerSymbol.X,
      guestSymbol: null,
    });

    handleRelayEvent(deps, { type: "peer-left", reason: "closed" });

    expect(getRoom().status).toBe("disconnected");
    expect(getRoom().gameState.winner).toBeNull();
    expect(getRoom().gameState.gameStatus).toBe(GameStatus.WAITING);
    expect(deps.stateRef.current.winner).toBeNull();
  });

  it("peer-left during ACTIVE still forfeits to the surviving host", () => {
    const game = activeGame();
    const { deps, getRoom } = makeDeps(game, "host", { hostSymbol: PlayerSymbol.X });

    handleRelayEvent(deps, { type: "peer-left", reason: "expired" });

    expect(getRoom().gameState.winner).toBe(PlayerSymbol.X);
    expect(getRoom().gameState.gameStatus).toBe(GameStatus.COMPLETED);
  });
});
