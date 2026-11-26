import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomClient } from "@/lib/roomClient";
import { Color, GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import type { PlayerSettings } from "@/game/constants";
import { createInitialGameState, makeMove, type GameState } from "@/game/logic";
import { startAsHost, type RoomLifecycleDeps } from "./roomLifecycle";
import type { HostSnapshot } from "@/lib/hostSnapshot";

vi.mock("@/lib/errorReporting", () => ({ reportError: vi.fn() }));

function lifecycleDeps() {
  const update = vi.fn();
  const deps: RoomLifecycleDeps = {
    roomRef: { current: null },
    stateRef: {
      current: createInitialGameState({
        gameMode: GameModes.ONLINE,
        playerXName: "Host",
        playerOName: "Guest",
        playerColor: Color.BLUE,
        opponentColor: Color.RED,
      }),
    },
    roleRef: { current: null },
    quickMatchHostRef: { current: false },
    hostSymbolRef: { current: null },
    guestSymbolRef: { current: null },
    hostDisplayName: "Host",
    hostColor: Color.BLUE,
    setState: vi.fn(),
    update,
    handleWsEvent: vi.fn(),
    handleHostData: vi.fn(),
    handleGuestData: vi.fn(),
    stopTimer: vi.fn(),
    rematchPendingRef: { current: false },
    lastSyncReplyAtRef: { current: 0 },
    guestJoinedRef: { current: false },
    hostPendingSettingsRef: { current: null as PlayerSettings | null },
    reconnectResetsRef: { current: { moveCount: -1 } },
    pendingGuestStateRef: { current: null as GameState | null },
    syncPendingRef: { current: false },
    waitingForHostTimeoutRef: { current: null },
    waitingForHostDeadlineAtRef: { current: null },
  };
  return { deps, update };
}

const played = (state: GameState, index: number): GameState => {
  const next = makeMove(state, index);
  if (!next) throw new Error("fixture move rejected");
  return next;
};

const resumeSnapshot = (): HostSnapshot => ({
  version: 1,
  roomId: "RESUME42",
  hostSymbol: PlayerSymbol.O,
  gameState: played(
    createInitialGameState({
      gameMode: GameModes.ONLINE,
      playerXName: "Guest",
      playerOName: "Host",
      playerColor: Color.RED,
      opponentColor: Color.BLUE,
    }),
    0,
  ),
});

const pendingConnect = () =>
  vi.spyOn(RoomClient.prototype, "connect").mockReturnValue(
    new Promise<never>(() => {}),
  );

const firstUpdate = (update: ReturnType<typeof vi.fn>) =>
  update.mock.calls[0][0] as {
    role: string;
    status: string;
    roomId: string;
    hostSymbol: PlayerSymbol;
    guestSymbol: PlayerSymbol;
    gameState: GameState;
  };

describe("startAsHost resume", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("seeds the room from the snapshot board, not a fresh WAITING board", () => {
    pendingConnect();
    const { deps, update } = lifecycleDeps();
    const snapshot = resumeSnapshot();

    startAsHost(deps, undefined, "ws://127.0.0.1:1", undefined, snapshot);

    expect(update).toHaveBeenCalledTimes(1);
    const patch = firstUpdate(update);
    expect(patch.role).toBe("host");
    expect(patch.status).toBe("creating");
    expect(patch.gameState).toBe(deps.stateRef.current);
    expect(patch.gameState.board).toEqual(snapshot.gameState.board);
    expect(patch.gameState.board).not.toEqual(Array(9).fill(null));
    expect(patch.gameState.gameStatus).toBe(GameStatus.ACTIVE);
  });

  it("reuses the snapshot room id and symbol", () => {
    pendingConnect();
    const { deps, update } = lifecycleDeps();
    const snapshot = resumeSnapshot();

    startAsHost(deps, undefined, "ws://127.0.0.1:1", undefined, snapshot);

    expect(deps.hostSymbolRef.current).toBe(PlayerSymbol.O);
    const patch = firstUpdate(update);
    expect(patch.roomId).toBe("RESUME42");
    expect(patch.hostSymbol).toBe(PlayerSymbol.O);
    expect(patch.guestSymbol).toBe(PlayerSymbol.X);
  });

  it("lets an explicit room id win over the snapshot's", () => {
    pendingConnect();
    const { deps, update } = lifecycleDeps();

    startAsHost(deps, "EXPLICIT1", "ws://127.0.0.1:1", undefined, resumeSnapshot());

    expect(firstUpdate(update).roomId).toBe("EXPLICIT1");
  });

  it("ignores the snapshot when a slot token marks a quick match", () => {
    pendingConnect();
    const { deps, update } = lifecycleDeps();

    startAsHost(deps, "QUICK123", "ws://127.0.0.1:1", "slot-token", resumeSnapshot());

    const patch = firstUpdate(update);
    expect(patch.roomId).toBe("QUICK123");
    expect(patch.gameState.gameStatus).toBe(GameStatus.WAITING);
    expect(patch.gameState.board.every((cell) => cell === null)).toBe(true);
    expect(deps.quickMatchHostRef.current).toBe(true);
  });

  it("rebuilds a stale turn deadline from the frozen remaining time", () => {
    pendingConnect();
    const { deps } = lifecycleDeps();
    const snapshot = resumeSnapshot();
    const staleDeadline = Date.now() - 60_000;
    snapshot.gameState = {
      ...snapshot.gameState,
      turnDeadlineAt: staleDeadline,
      turnTimeRemaining: 4_000,
    };

    startAsHost(deps, undefined, "ws://127.0.0.1:1", undefined, snapshot);

    const deadline = deps.stateRef.current.turnDeadlineAt ?? 0;
    expect(deadline).toBeGreaterThan(staleDeadline);
    expect(deadline).toBeGreaterThanOrEqual(Date.now() + 3_000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  it("keeps a turn deadline that is still in the future", () => {
    pendingConnect();
    const { deps } = lifecycleDeps();
    const snapshot = resumeSnapshot();
    const futureDeadline = Date.now() + 60_000;
    snapshot.gameState = { ...snapshot.gameState, turnDeadlineAt: futureDeadline };

    startAsHost(deps, undefined, "ws://127.0.0.1:1", undefined, snapshot);

    expect(deps.stateRef.current.turnDeadlineAt).toBe(futureDeadline);
  });
});
