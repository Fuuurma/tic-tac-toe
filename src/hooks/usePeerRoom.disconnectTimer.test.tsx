// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { Color, GameModes, GameStatus, PlayerSymbol } from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { GameState } from "@/game/logic";
import type { RoomClient } from "@/lib/room";
import type { RoomLifecycleDeps } from "./peer-room/roomLifecycle";
import { usePeerRoom } from "./usePeerRoom";

// TTT-TIMER-TRANSITION-01 (tic-tac-toe F217).
//
// A transient relay `peer-left` with reason "disconnect" must stop the turn
// timer AT THE MOMENT THE TRANSITION IS ACCEPTED. The old code decided that
// by setting a `transitioned` flag inside the setState updater and reading it
// on the next line:
//
//     let transitioned = false;
//     setState((prev) => { ...; transitioned = true; return next; });
//     if (transitioned) stopTimer();
//
// React does not run an updater synchronously — it runs during the following
// render — so the flag is still false when it is read and stopTimer() never
// fires. Nothing else stopped it until the status effect re-ran on the next
// commit, which left a window in which the turn interval could tick with
// stateRef still reading "connected".
//
// That window is a data-integrity problem, not a cosmetic one: the tick is
// the host's clock, and at the deadline the host plays a random move and
// broadcasts it. While the socket is down, RoomClient.send silently drops the
// frame, so the peer never sees the move and the two boards diverge for good
// — the exact failure the start-timer effect's own comment warns about ("a
// forced-move broadcast is silently dropped ... permanent host/guest
// divergence"). This test drives the handler with the React update left
// PENDING, advances past the turn deadline, and asserts nothing went on the
// wire.

const harness = vi.hoisted(() => ({
  send: vi.fn(),
  close: vi.fn(),
  reconnectNow: vi.fn(),
  deps: null as RoomLifecycleDeps | null,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const TURN_WINDOW_MS = 10_000;

vi.mock("./peer-room/roomLifecycle", async (importActual) => {
  const actual =
    await importActual<typeof import("./peer-room/roomLifecycle")>();
  return {
    ...actual,
    // Same seam as usePeerRoom.rematchTimeout.test.tsx, but an ACTIVE game
    // with a turn deadline, because the terminal game that harness installs
    // makes isGameActive() false and the turn interval would never run.
    startAsHost: (deps: RoomLifecycleDeps) => {
      harness.deps = deps;
      const game: GameState = {
        ...freshGameState(),
        gameMode: GameModes.ONLINE,
        gameStatus: GameStatus.ACTIVE,
        winner: null,
        turnDeadlineAt: Date.now() + TURN_WINDOW_MS,
      };
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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  harness.send.mockClear();
  harness.deps = null;
});

describe("usePeerRoom transient-disconnect turn timer", () => {
  it("stops the turn timer synchronously, before React commits the reconnecting state", () => {
    renderHostRoom();
    const sendCallsBefore = harness.send.mock.calls.length;

    // Sit just short of the deadline with the clock running.
    act(() => vi.advanceTimersByTime(TURN_WINDOW_MS - 100));
    expect(harness.send.mock.calls.length).toBe(sendCallsBefore);

    // The relay frame arrives OUTSIDE act on purpose: React leaves the
    // setState pending, which is the real ordering (a WebSocket message is
    // not inside React's batching for the subsequent timer callbacks). The
    // timer must already be disarmed by the time this call returns.
    harness.deps?.handleWsEvent({ type: "peer-left", reason: "disconnect" });

    // Cross the deadline with the update still uncommitted. If the timer is
    // still armed, the host plays its random move and the frame is dropped
    // by the down socket — silent, permanent divergence.
    act(() => vi.advanceTimersByTime(500));

    expect(
      harness.send.mock.calls.length,
      "a turn fired after a transient disconnect: the timer was not stopped " +
        "when the reconnecting transition was accepted",
    ).toBe(sendCallsBefore);
  });

  it("still reports the reconnecting state once React commits", () => {
    // The guard and the user-visible message must survive the fix.
    const { result } = renderHostRoom();

    act(() => {
      harness.deps?.handleWsEvent({ type: "peer-left", reason: "disconnect" });
    });

    expect(result.current.state.status).toBe("reconnecting");
  });

  it("leaves an already-disconnected forfeit alone (the pre-existing guard)", () => {
    // A deliberate leave/forfeit sets "disconnected" + winner BEFORE the
    // relay's transient event arrives. Without the guard the disconnect
    // flips it back to "reconnecting" for the 30s grace and hides the
    // forfeit result (fleet audit 2026-09-06 P2-1). The fix must not trade
    // one bug for the other.
    const { result } = renderHostRoom();

    act(() => {
      result.current.leave();
    });
    expect(result.current.state.status).toBe("disconnected");

    act(() => {
      harness.deps?.handleWsEvent({ type: "peer-left", reason: "disconnect" });
    });

    expect(result.current.state.status).toBe("disconnected");
  });
});
