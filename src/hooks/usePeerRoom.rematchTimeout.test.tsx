// @vitest-environment jsdom

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
import type { RoomClient } from "@/lib/room";
import type { RoomLifecycleDeps } from "./peer-room/roomLifecycle";
import { usePeerRoom } from "./usePeerRoom";

// Regression coverage for the host-side rematch deadline (fleet 09-13):
// an unanswered request must expire — rematchCancel on the wire plus
// "Rematch request expired" + rematchOutgoing=false locally — instead of
// hanging on "Waiting for opponent to accept rematch" forever. Every
// resolution path (guest accept, guest decline, host cancel, terminal
// peer-left, unmount) must disarm the timer so a late expiry can't send
// a stray rematchCancel after the prompt already resolved.

const harness = vi.hoisted(() => ({
  send: vi.fn(),
  close: vi.fn(),
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

vi.mock("./peer-room/roomLifecycle", async (importActual) => {
  const actual =
    await importActual<typeof import("./peer-room/roomLifecycle")>();
  return {
    ...actual,
    // Test seam: skip the real WebSocket handshake — install a scripted
    // host session (connected + terminal game + send-spy room) and capture
    // the hook's lifecycle deps so tests can replay peer frames through
    // handleHostData.
    startAsHost: (deps: RoomLifecycleDeps) => {
      harness.deps = deps;
      const game = terminalGame();
      deps.roleRef.current = "host";
      deps.hostSymbolRef.current = PlayerSymbol.X;
      deps.stateRef.current = game;
      deps.roomRef.current = {
        send: harness.send,
        close: harness.close,
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

const rematchCancelCount = () =>
  harness.send.mock.calls.filter(
    (call) => (call[0] as { type?: string }).type === "rematchCancel",
  ).length;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  harness.send.mockClear();
  harness.deps = null;
});

describe("usePeerRoom host rematch timeout", () => {
  it("expires an unanswered request: rematchCancel + 'Rematch request expired' + rematchOutgoing=false", () => {
    const { result } = renderHostRoom();

    act(() => result.current.requestRematch());
    expect(harness.send).toHaveBeenCalledWith({
      type: "rematchRequested",
      requesterSymbol: PlayerSymbol.X,
    });
    expect(result.current.state.rematchOutgoing).toBe(true);
    expect(result.current.state.message).toBe(
      "Waiting for opponent to accept rematch",
    );

    // Just before the deadline nothing has fired yet.
    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS - 1));
    expect(rematchCancelCount()).toBe(0);
    expect(result.current.state.rematchOutgoing).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(harness.send).toHaveBeenCalledWith({ type: "rematchCancel" });
    expect(rematchCancelCount()).toBe(1);
    expect(result.current.state.rematchOutgoing).toBe(false);
    expect(result.current.state.message).toBe("Rematch request expired");

    // The one-shot timer must not re-fire.
    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS * 2));
    expect(rematchCancelCount()).toBe(1);
  });

  it("a guest rematchAccept disarms the timer — no late rematchCancel", () => {
    const { result } = renderHostRoom();
    act(() => result.current.requestRematch());

    act(() => harness.deps?.handleHostData({ type: "rematchAccept" }));
    expect(result.current.state.rematchOutgoing).toBe(false);

    // The accept reset starts a fresh ACTIVE game, so the turn clock is
    // legitimately ticking here — assert on the wire instead: advancing
    // well past the deadline must not send a late rematchCancel.
    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS * 2));
    expect(rematchCancelCount()).toBe(0);
  });

  it("a guest rematchDecline disarms the timer — no late rematchCancel", () => {
    const { result } = renderHostRoom();
    act(() => result.current.requestRematch());
    expect(result.current.state.rematchOutgoing).toBe(true);

    act(() => harness.deps?.handleHostData({ type: "rematchDecline" }));
    expect(result.current.state.rematchOutgoing).toBe(false);
    expect(result.current.state.message).toBe("Rematch declined");
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS * 2));
    expect(rematchCancelCount()).toBe(0);
  });

  it("a terminal peer-left disarms the timer — no late rematchCancel", () => {
    const { result } = renderHostRoom();
    act(() => result.current.requestRematch());
    expect(result.current.state.rematchOutgoing).toBe(true);

    // "closed" is a final departure, so the pending request is torn down
    // with the room. (A "disconnect" peer-left is the transient 30s
    // reconnect grace and intentionally keeps the request pending.)
    act(() =>
      harness.deps?.handleWsEvent({ type: "peer-left", reason: "closed" }),
    );
    expect(result.current.state.status).toBe("disconnected");
    expect(result.current.state.rematchOutgoing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS * 2));
    expect(rematchCancelCount()).toBe(0);
  });

  it("cancelRematch disarms the timer — no second rematchCancel after the deadline", () => {
    const { result } = renderHostRoom();
    act(() => result.current.requestRematch());

    act(() => result.current.cancelRematch());
    // The explicit cancel itself goes on the wire exactly once.
    expect(rematchCancelCount()).toBe(1);
    expect(result.current.state.rematchOutgoing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS * 2));
    expect(rematchCancelCount()).toBe(1);
  });

  it("unmount disarms the timer — no rematchCancel fires on a dead room", () => {
    const { result, unmount } = renderHostRoom();
    act(() => result.current.requestRematch());
    expect(vi.getTimerCount()).toBe(1);

    act(() => unmount());
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(REMATCH_TIMEOUT_MS * 2));
    expect(rematchCancelCount()).toBe(0);
  });
});
