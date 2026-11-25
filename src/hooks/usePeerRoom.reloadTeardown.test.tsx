"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  REMATCH_TIMEOUT_MS,
} from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { RoomClient } from "@/lib/roomClient";
import type { RoomLifecycleDeps } from "@/lib/room-protocol/roomLifecycle";
import { usePeerRoom } from "./usePeerRoom";

const harness = vi.hoisted(() => ({
  send: vi.fn(),
  close: vi.fn(),
  closeForReconnect: vi.fn(),
  reconnectNow: vi.fn(),
  deps: null as RoomLifecycleDeps | null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const terminalGame = (): GameState => ({
  ...freshGameState(),
  gameMode: GameModes.ONLINE,
  gameStatus: GameStatus.COMPLETED,
  winner: PlayerSymbol.X,
});

vi.mock("@/lib/room-protocol/roomLifecycle", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/room-protocol/roomLifecycle")>();
  return {
    ...actual,
    startAsHost: (deps: RoomLifecycleDeps) => {
      harness.deps = deps;
      const game = terminalGame();
      deps.roleRef.current = "host";
      deps.hostSymbolRef.current = PlayerSymbol.X;
      deps.stateRef.current = game;
      deps.roomRef.current = {
        send: harness.send,
        close: harness.close,
        closeForReconnect: harness.closeForReconnect,
        reconnectNow: harness.reconnectNow,
      } as unknown as RoomClient;
      deps.update({
        role: "host",
        status: "connected",
        roomId: "TESTROOM",
        hostSymbol: PlayerSymbol.X,
        guestSymbol: PlayerSymbol.O,
        gameState: game,
        message: "",
      });
    },
  };
});

function renderHostRoom() {
  const view = renderHook(() =>
    usePeerRoom({
      hostDisplayName: "Host",
      hostColor: Color.BLUE,
      gameMode: GameModes.ONLINE,
    }),
  );
  act(() => {
    view.result.current.startAsHost("TESTROOM", "ws://localhost/test");
  });
  return view;
}

const leaveFrames = () =>
  harness.send.mock.calls.filter(
    (call) => (call[0] as { type?: string }).type === "leave",
  ).length;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  harness.send.mockClear();
  harness.close.mockClear();
  harness.closeForReconnect.mockClear();
  harness.reconnectNow.mockClear();
  harness.deps = null;
});

describe("usePeerRoom reload teardown", () => {
  it("unmount closes the transport for reconnect without the leave frame", () => {
    const { result, unmount } = renderHostRoom();
    act(() => result.current.requestRematch());
    expect(vi.getTimerCount()).toBe(1);

    act(() => unmount());

    expect(harness.closeForReconnect).toHaveBeenCalledTimes(1);
    expect(harness.close).not.toHaveBeenCalled();
    expect(leaveFrames()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("explicit leave still sends the leave frame before closing", () => {
    const { result } = renderHostRoom();

    act(() => result.current.leave());

    expect(harness.send).toHaveBeenCalledWith({ type: "leave" });
    expect(harness.close).toHaveBeenCalledTimes(1);
    expect(harness.closeForReconnect).not.toHaveBeenCalled();
    expect(
      harness.send.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.close.mock.invocationCallOrder[0]);
    expect(result.current.state.leftBySelf).toBe(true);
    expect(result.current.state.status).toBe("disconnected");
    expect(result.current.state.canRetryReconnect).toBe(false);
  });

  it("closeTransport tears the room down passively while mounted", () => {
    const { result } = renderHostRoom();
    act(() => result.current.requestRematch());
    expect(vi.getTimerCount()).toBe(1);

    act(() => result.current.closeTransport());

    expect(harness.closeForReconnect).toHaveBeenCalledTimes(1);
    expect(harness.close).not.toHaveBeenCalled();
    expect(leaveFrames()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.state.status).toBe("connected");
  });
});
