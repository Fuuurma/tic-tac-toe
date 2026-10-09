import { describe, it, expect, vi, afterEach } from "vitest";
import { GameStatus, PLAYER_CONFIG, PlayerSymbol } from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { RoomClient } from "@/lib/room";
import type { PeerRoomState } from "../usePeerRoom";
import {
  acceptIncomingRematch,
  applyHostMove,
  handleHostMessage,
  SYNC_REPLY_COOLDOWN_MS,
  type HostProtocolDeps,
} from "./hostProtocol";

// Regression pins for the rematch deadline wiring — every path that
// resolves a pending host rematch request must clear its timeout
// (fleet 09-13 finding: host waited forever on a silent guest).

// The throttle tests fake timers; never let the fake clock leak into
// the wall-clock assertions elsewhere in the file.
afterEach(() => {
  vi.useRealTimers();
});

function terminalGame(): GameState {
  return {
    ...freshGameState(),
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
  };
}

function makeDeps(game: GameState) {
  let roomState = { gameState: game } as PeerRoomState;
  const deps: HostProtocolDeps = {
    stateRef: { current: game },
    roomRef: { current: { send: vi.fn() } as unknown as RoomClient },
    hostSymbolRef: { current: PlayerSymbol.X },
    rematchPendingRef: { current: true },
    // Fresh once-per-move reconnect-reset budget (relayEvents consumes
    // it; rematch must re-arm it for the new round).
    reconnectResetsRef: { current: { moveCount: -1 } },
    // One full window in the past — the same "disarmed" value
    // disarmSyncReplyThrottle writes, so pulls are answered immediately.
    lastSyncReplyAtRef: { current: -SYNC_REPLY_COOLDOWN_MS },
    // Most tests exercise the post-join surface — the flag flips on join.
    guestJoinedRef: { current: true },
    hostPendingSettingsRef: { current: null },
    pausedRef: { current: false },
    setState: (updater) => {
      roomState = typeof updater === "function" ? updater(roomState) : updater;
    },
    commitHostState: (g) => {
      deps.stateRef.current = g;
      roomState = { ...roomState, gameState: g };
    },
    broadcastGameState: vi.fn(),
    stopTimer: vi.fn(),
    clearRematchTimeout: vi.fn(),
  };
  return { deps, getRoom: () => roomState };
}

describe("handleHostMessage sync_request (DST-04 reconnect contract)", () => {
  it("replies state_snapshot with the wire state (deadline stripped)", () => {
    const game = {
      ...terminalGame(),
      gameStatus: GameStatus.ACTIVE,
      winner: null,
      turnDeadlineAt: Date.now() + 5_000,
      turnTimeRemaining: 5_000,
    };
    const { deps } = makeDeps(game);

    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).toHaveBeenCalledTimes(1);
    const frame = (deps.roomRef.current!.send as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { type: string; gameState: GameState };
    expect(frame.type).toBe("state_snapshot");
    expect(frame.gameState.turnDeadlineAt).toBeUndefined();
    expect(frame.gameState.turnTimeRemaining).toBeGreaterThanOrEqual(0);
    // Read-only contract: host state is untouched by the request.
    expect(deps.stateRef.current).toBe(game);
  });

  it("does not reply while the room is still WAITING (pre-join pull)", () => {
    const game: GameState = {
      ...terminalGame(),
      gameStatus: GameStatus.WAITING,
      winner: null,
    };
    const { deps } = makeDeps(game);
    deps.guestJoinedRef.current = false; // real WAITING rooms are pre-join

    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).not.toHaveBeenCalled();
  });

  it("refuses a never-joined peer even when the game is ACTIVE or COMPLETED", () => {
    // Review 2026-10-03 repair P2: gating on status alone let any peer
    // pull full GameState (names/colors) with one sync_request — the
    // same pre-join leak the WAITING check covered, one status later.
    for (const gameStatus of [GameStatus.ACTIVE, GameStatus.COMPLETED]) {
      const game: GameState = {
        ...terminalGame(),
        gameStatus,
        winner: gameStatus === GameStatus.COMPLETED ? PlayerSymbol.X : null,
      };
      const { deps } = makeDeps(game);
      deps.guestJoinedRef.current = false;

      handleHostMessage(deps, { type: "sync_request" });

      expect(deps.roomRef.current!.send).not.toHaveBeenCalled();
      expect(deps.lastSyncReplyAtRef.current).toBe(-SYNC_REPLY_COOLDOWN_MS);
    }
  });

  it("a real join unlocks pulls — flag flips on the join path", () => {
    const game: GameState = {
      ...terminalGame(),
      gameStatus: GameStatus.WAITING,
      winner: null,
    };
    const { deps } = makeDeps(game);
    deps.guestJoinedRef.current = false;

    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });
    expect(deps.guestJoinedRef.current).toBe(true);

    (deps.roomRef.current!.send as ReturnType<typeof vi.fn>).mockClear();
    handleHostMessage(deps, { type: "sync_request" });

    const frame = (deps.roomRef.current!.send as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { type: string };
    expect(frame.type).toBe("state_snapshot");
  });

  it("replies once the game is COMPLETED — the pull is the terminal catch-up", () => {
    // A guest that missed the terminal broadcast (dropped join resync)
    // has no other way to learn the game ended — refusing the pull
    // would leave it on an ACTIVE board forever (review 2026-10-03
    // repair P2).
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).toHaveBeenCalledTimes(1);
    const frame = (deps.roomRef.current!.send as ReturnType<typeof vi.fn>)
      .mock.calls[0][0] as { type: string; gameState: GameState };
    expect(frame.type).toBe("state_snapshot");
    expect(frame.gameState.gameStatus).toBe(GameStatus.COMPLETED);
  });

  it("throttles burst pulls — one snapshot per cooldown window", () => {
    // Fake timers drive the same clock the code reads (performance.now
    // is monotonic and vitest fakes it) — advancing time proves the
    // branch instead of rewinding the ref the code never reads
    // (review 2026-10-03 repair P2).
    vi.useFakeTimers();
    const game = {
      ...terminalGame(),
      gameStatus: GameStatus.ACTIVE,
      winner: null,
    };
    const { deps } = makeDeps(game);

    handleHostMessage(deps, { type: "sync_request" });
    handleHostMessage(deps, { type: "sync_request" });
    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).toHaveBeenCalledTimes(1);

    // After the cooldown the next pull is answered again.
    vi.advanceTimersByTime(SYNC_REPLY_COOLDOWN_MS);
    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).toHaveBeenCalledTimes(2);
  });

  it("refused pulls leave the throttle clock untouched", () => {
    // A pull dropped by the join/status gates must not consume the
    // window — otherwise a refused attempt would delay the peer's next
    // legitimate pull (review 2026-10-03 repair P2).
    vi.useFakeTimers();
    const game: GameState = {
      ...terminalGame(),
      gameStatus: GameStatus.WAITING,
      winner: null,
    };
    const { deps } = makeDeps(game);
    const before = deps.lastSyncReplyAtRef.current;

    handleHostMessage(deps, { type: "sync_request" });

    expect(deps.roomRef.current!.send).not.toHaveBeenCalled();
    expect(deps.lastSyncReplyAtRef.current).toBe(before);
  });

  it("a processed join disarms the throttle — catch-up pull answered inside the old window", () => {
    // Cross-game starvation pin (review 2026-10-03 repair P2): a reply
    // sent <1s ago must not starve the reconnecting guest's first pull —
    // the join processing resets the window.
    vi.useFakeTimers();
    const game = {
      ...terminalGame(),
      gameStatus: GameStatus.ACTIVE,
      winner: null,
    };
    const { deps } = makeDeps(game);
    const send = deps.roomRef.current!.send as ReturnType<typeof vi.fn>;

    handleHostMessage(deps, { type: "sync_request" });
    expect(
      send.mock.calls.filter(
        ([f]) => (f as { type: string }).type === "state_snapshot",
      ),
    ).toHaveLength(1);

    // Mid-game join lands as a resync — the same tick, well inside the
    // 1s cooldown that just consumed a reply.
    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });
    handleHostMessage(deps, { type: "sync_request" });

    const snapshots = send.mock.calls.filter(
      ([f]) => (f as { type: string }).type === "state_snapshot",
    );
    expect(snapshots).toHaveLength(2);
  });

  it("a rematch reset disarms the throttle — post-rematch pull answered without waiting 1s", () => {
    // The reviewer's scenario: the terminal snapshot reply lands <1s
    // before the guest's catch-up pull on the rematched game. Without a
    // reset on rematchAccept the second pull is silently dropped.
    vi.useFakeTimers();
    const { deps } = makeDeps(terminalGame());
    const send = deps.roomRef.current!.send as ReturnType<typeof vi.fn>;

    handleHostMessage(deps, { type: "sync_request" });
    expect(
      send.mock.calls.filter(
        ([f]) => (f as { type: string }).type === "state_snapshot",
      ),
    ).toHaveLength(1);

    handleHostMessage(deps, { type: "rematchAccept" });
    expect(deps.stateRef.current.gameStatus).toBe(GameStatus.ACTIVE);

    // Same tick — inside the cooldown the old code would still enforce.
    handleHostMessage(deps, { type: "sync_request" });

    const snapshots = send.mock.calls.filter(
      ([f]) => (f as { type: string }).type === "state_snapshot",
    );
    expect(snapshots).toHaveLength(2);
  });
});

describe("handleHostMessage rematch deadline", () => {
  it("rematchAccept clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "rematchAccept" });

    expect(deps.rematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });

  it("F362: rematchAccept re-arms the reconnect-reset budget for the new round", () => {
    // The once-per-move full-deadline reset on reconnect is keyed on
    // moveCount, which restarts at 0 every round. A budget consumed in
    // round one must not survive into round two, or a reconnect at the
    // same moveCount gets no reset and the next tick can force a move.
    const { deps } = makeDeps(terminalGame());
    deps.reconnectResetsRef.current.moveCount = 5; // consumed in round one

    handleHostMessage(deps, { type: "rematchAccept" });

    expect(deps.reconnectResetsRef.current.moveCount).toBe(-1);
  });

  it("rematchDecline clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "rematchDecline" });

    expect(deps.rematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });

  it("F254: a stray rematchDecline with no pending request writes nothing", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.rematchPendingRef.current = false;
    const before = getRoom().message;

    handleHostMessage(deps, { type: "rematchDecline" });

    expect(getRoom().message).toBe(before);
    expect(deps.clearRematchTimeout).not.toHaveBeenCalled();
  });

  it("leave clears the pending flag + timeout", () => {
    const { deps } = makeDeps(terminalGame());

    handleHostMessage(deps, { type: "leave" });

    expect(deps.rematchPendingRef.current).toBe(false);
    expect(deps.clearRematchTimeout).toHaveBeenCalledOnce();
  });

  it("leave during WAITING does not crown a phantom host win (F146)", () => {
    const waiting: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.WAITING,
    };
    const { deps, getRoom } = makeDeps(waiting);

    handleHostMessage(deps, { type: "leave" });

    expect(getRoom().status).toBe("disconnected");
    expect(getRoom().gameState.winner).toBeNull();
    expect(getRoom().gameState.gameStatus).toBe(GameStatus.WAITING);
  });
});

describe("handleHostMessage invalid guest move", () => {
  // The relay RESERVES the `error` frame type for itself and answers a
  // client-sent one back to the sender, so the host can never deliver a
  // rejection to the guest. It resyncs with an authoritative gameUpdate
  // instead; the guest detects a non-landing move by comparing moveCount
  // against its own rollback snapshot. Sending `error` here would look
  // correct in a unit test and diverge both boards in production.
  it("resyncs the guest with the authoritative state so its move is withdrawn", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.X, // host's turn — a guest move is illegal
    };
    const { deps } = makeDeps(game);

    handleHostMessage(deps, { type: "move", index: 0 });

    expect(deps.stateRef.current).toBe(game);
    const send = deps.roomRef.current!.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(1);
    const frame = send.mock.calls[0][0] as { type: string; gameState: GameState };
    expect(frame.type).toBe("gameUpdate");
    expect(frame.gameState.moveCount).toBe(0);
    expect(frame.gameState.board).toEqual(game.board);
  });

  it("does not resync the guest for the host's own rejected move", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O, // guest's turn — host move is illegal
    };
    const { deps } = makeDeps(game);

    applyHostMove(deps, 0, PlayerSymbol.X);

    expect(deps.stateRef.current).toBe(game);
    expect(deps.roomRef.current?.send).not.toHaveBeenCalled();
  });
});

// A paused host froze its clock on purpose; accepting a move while frozen
// would restart the turn at a full TURN_DURATION_MS and hand the guest free
// time. sendMove gates the host's own clicks on pausedRef; this is the same
// gate for moves arriving over the wire.
describe("applyHostMove pause gate (F225 host half)", () => {
  it("ignores an inbound guest move while a mid-game overlay has frozen the clock", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O,
    };
    const { deps } = makeDeps(game);
    deps.pausedRef.current = true;

    handleHostMessage(deps, { type: "move", index: 0 });

    expect(deps.stateRef.current).toBe(game);
    expect(deps.roomRef.current?.send).not.toHaveBeenCalled();
  });

  it("still applies the guest's move once the overlay closes", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O,
    };
    const { deps } = makeDeps(game);
    deps.pausedRef.current = false;

    handleHostMessage(deps, { type: "move", index: 0 });

    expect(deps.stateRef.current.board[0]).toBe(PlayerSymbol.O);
    expect(deps.stateRef.current.turnDeadlineAt).toBeDefined();
  });
});

describe("handleHostMessage unassigned host symbol", () => {
  it("resyncs a guest move instead of dropping it silently (F159)", () => {
    const game: GameState = {
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      currentPlayer: PlayerSymbol.O,
    };
    const { deps } = makeDeps(game);
    deps.hostSymbolRef.current = null;

    handleHostMessage(deps, { type: "move", index: 0 });

    expect(deps.stateRef.current).toBe(game);
    const send = deps.roomRef.current!.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as { type: string }).type).toBe("gameUpdate");
  });

  it("resyncs a guest join instead of leaving it waiting on `joined` forever", () => {
    const { deps } = makeDeps(freshGameState());
    deps.hostSymbolRef.current = null;

    handleHostMessage(deps, {
      type: "join",
      displayName: "guest",
      guestId: "g-1",
    });

    const send = deps.roomRef.current!.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0][0] as { type: string }).type).toBe("gameUpdate");
  });
});

// Rematch used to be host-only: the guest could answer a request but could
// never make one. These pin the symmetric contract — either side asks, the
// other is prompted, and the host still owns the reset.
describe("handleHostMessage guest-initiated rematch", () => {
  it("prompts the host when the guest asks for a rematch", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.rematchPendingRef.current = false;

    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });

    expect(getRoom().rematchIncoming).toBe(true);
    expect(getRoom().message).toContain("wants a rematch");
    // The host is the one who resets, so it does not accept on the wire yet.
    expect(deps.roomRef.current?.send).not.toHaveBeenCalled();
  });

  it("ignores a guest request while the game is still running", () => {
    const { deps, getRoom } = makeDeps({
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      winner: null,
    });
    deps.rematchPendingRef.current = false;

    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });

    expect(getRoom().rematchIncoming).toBeFalsy();
    // No prompt text was written either.
    expect(getRoom().message).toBeUndefined();
  });

  it("ignores a rematch request from a peer that never joined", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.rematchPendingRef.current = false;
    deps.guestJoinedRef.current = false;

    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });

    expect(getRoom().rematchIncoming).toBeFalsy();
  });

  it("does not overwrite a prompt the host is already showing", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.rematchPendingRef.current = false;

    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });
    const first = getRoom().message;
    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });

    expect(getRoom().message).toBe(first);
    expect(getRoom().rematchIncoming).toBe(true);
  });

  it("clears the prompt when the guest withdraws the request", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.rematchPendingRef.current = false;
    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });
    expect(getRoom().rematchIncoming).toBe(true);

    handleHostMessage(deps, { type: "rematchCancel" });

    expect(getRoom().rematchIncoming).toBe(false);
    expect(getRoom().message).toContain("withdrawn");
  });

  it("resets the game and announces it when the host accepts", () => {
    const { deps, getRoom } = makeDeps(terminalGame());
    deps.rematchPendingRef.current = false;
    handleHostMessage(deps, {
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.O,
    });

    acceptIncomingRematch(deps);

    expect(deps.stateRef.current.winner).toBeNull();
    expect(deps.stateRef.current.gameStatus).not.toBe(GameStatus.COMPLETED);
    expect(getRoom().rematchIncoming).toBe(false);
    expect(deps.roomRef.current?.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "gameStart" }),
    );
  });

  it("refuses to accept while the game is still in progress", () => {
    const { deps } = makeDeps({
      ...freshGameState(),
      gameStatus: GameStatus.ACTIVE,
      winner: null,
    });

    acceptIncomingRematch(deps);

    expect(deps.stateRef.current.winner).toBeNull();
    expect(deps.roomRef.current?.send).not.toHaveBeenCalled();
  });
});

describe("F582: the rematch host name is sanitized before it reaches the next match", () => {
  const namedGame = (): GameState => {
    const game = freshGameState();
    game.players[PlayerSymbol.X] = { ...game.players[PlayerSymbol.X], username: "Host" };
    game.players[PlayerSymbol.O] = { ...game.players[PlayerSymbol.O], username: "Guest" };
    return { ...game, gameStatus: GameStatus.COMPLETED, winner: PlayerSymbol.X };
  };
  const pendingFor = (displayName: string) => ({
    displayName,
    color: PLAYER_CONFIG[PlayerSymbol.X].defaultColor,
    playerShape: PLAYER_CONFIG[PlayerSymbol.X].defaultShape,
  });

  it("a cleared pending name falls back to the current username, not the empty string", () => {
    const { deps } = makeDeps(namedGame());
    deps.hostPendingSettingsRef.current = pendingFor("");

    handleHostMessage(deps, { type: "rematchAccept" });

    const names = [
      deps.stateRef.current.players[PlayerSymbol.X].username,
      deps.stateRef.current.players[PlayerSymbol.O].username,
    ];
    expect(names).toContain("Host");
    expect(names).toContain("Guest");
  });

  it("invisible padding and whitespace runs are normalized into the next match (join-path parity)", () => {
    const { deps } = makeDeps(namedGame());
    deps.hostPendingSettingsRef.current = pendingFor("  Zoe\u200B\t B ");

    handleHostMessage(deps, { type: "rematchAccept" });

    const names = [
      deps.stateRef.current.players[PlayerSymbol.X].username,
      deps.stateRef.current.players[PlayerSymbol.O].username,
    ];
    expect(names).toContain("Zoe B");
  });
});
