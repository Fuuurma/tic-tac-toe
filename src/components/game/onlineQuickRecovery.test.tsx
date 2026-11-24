import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { builtinEnvironments } from "vitest/runtime";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { OnlineGameSurface } from "./onlineGameSurface";
import { freshGameState } from "@/game/logic";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
} from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";

const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
  recordWin: vi.fn(),
  recordLoss: vi.fn(),
  playerCount: null as { players: number; waiting: number } | null,
}));

vi.mock("@/hooks/usePeerRoom", () => ({
  usePeerRoom: mocks.usePeerRoom,
}));
vi.mock("@/hooks/useGameStats", () => ({
  useGameStats: () => ({
    recordWin: mocks.recordWin,
    recordLoss: mocks.recordLoss,
  }),
}));
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));
vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({ count: mocks.playerCount, refresh: () => {} }),
}));

let teardownEnvironment: (() => unknown) | undefined;

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  await teardownEnvironment?.();
});

afterEach(() => {
  cleanup();
  mocks.playerCount = null;
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

function makePeer(stateOverrides: Partial<PeerRoomState> = {}) {
  return {
    state: {
      role: "host",
      status: "creating",
      queue: "searching",
      roomId: "QM-5150",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: true,
      gameState: freshGameState(),
      ...stateOverrides,
    } as PeerRoomState,
    startAsHost: vi.fn(),
    startQuickMatch: vi.fn(),
    joinAsGuest: vi.fn(),
    sendMove: vi.fn(),
    requestRematch: vi.fn(),
    declineRematch: vi.fn(),
    cancelRematch: vi.fn(),
    retryReconnect: vi.fn(),
    leave: vi.fn(),
    updatePendingSettings: vi.fn(),
    setPaused: vi.fn(),
    paused: false,
  };
}

const quickConfig = {
  displayName: "Player",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  gameMode: GameModes.ONLINE,
  onlineRoomId: "",
  onlineAction: "quick" as const,
};

type View = ReturnType<typeof render>;

const expectNoGameArea = (view: View) => {
  expect(view.queryByRole("button", { name: /Row 1 column 1/ })).toBeNull();
  expect(view.queryByRole("toolbar", { name: "Game actions" })).toBeNull();
  expect(view.queryByRole("button", { name: "Mute reactions" })).toBeNull();
  expect(view.queryByText("Online")).toBeNull();
};

const startWarmup = (peer = makePeer(), onExit = vi.fn()) => {
  mocks.usePeerRoom.mockReturnValue(peer);
  const view = render(<OnlineGameSurface config={quickConfig} onExit={onExit} />);
  fireEvent.click(
    view.getByRole("button", { name: "Play the computer while you wait" }),
  );
  return { ...view, peer, onExit };
};

const moveTo = (
  view: ReturnType<typeof startWarmup>,
  state: Partial<PeerRoomState>,
) => {
  mocks.usePeerRoom.mockReturnValue({
    ...view.peer,
    state: { ...view.peer.state, ...state },
  });
  view.rerender(<OnlineGameSurface config={quickConfig} onExit={view.onExit} />);
};

describe("OnlineGameSurface: a Quick Match that loses the connection before the first move", () => {
  it("keeps the computer warm-up on screen through a reconnect", () => {
    const view = startWarmup();
    moveTo(view, { status: "creating", queue: "matched" });
    moveTo(view, {
      status: "reconnecting",
      queue: "matched",
      message: "Reconnecting...",
    });

    view.getByText("vs Computer");
    view.getByRole("button", { name: /Row 1 column 1/ });
    expect(view.queryByText("Online")).toBeNull();
  });

  it("keeps the computer warm-up and offers another search when the opponent never arrives", () => {
    const view = startWarmup();
    moveTo(view, { status: "creating", queue: "matched" });
    moveTo(view, {
      status: "disconnected",
      queue: "none",
      message: "Your opponent left the room.",
    });

    view.getByRole("button", { name: /Row 1 column 1/ });
    view.getByText("Your opponent left the room.");
    view.getByRole("button", { name: "Search again" });
    view.getByRole("button", { name: "Back to setup" });
    expect(view.queryByText("Online")).toBeNull();
  });

  it("shows the recovery card instead of an empty board when no warm-up is open", () => {
    for (const [status, message] of [
      ["reconnecting", "Socket dropped"],
      ["disconnected", "Your opponent left the room."],
    ] as const) {
      mocks.usePeerRoom.mockReturnValue(
        makePeer({ status, queue: "matched", message }),
      );
      const view = render(
        <OnlineGameSurface config={quickConfig} onExit={vi.fn()} />,
      );

      expectNoGameArea(view);
      view.getByText(message);
      view.getByRole("button", { name: "Retry now" });
      view.unmount();
    }
  });

  it("never discloses the room id, in any of these states", () => {
    for (const status of ["reconnecting", "disconnected"] as const) {
      mocks.usePeerRoom.mockReturnValue(
        makePeer({ status, queue: "matched", message: "Socket dropped" }),
      );
      const view = render(
        <OnlineGameSurface config={quickConfig} onExit={vi.fn()} />,
      );

      expect(view.queryByText("QM-5150")).toBeNull();
      expect(view.queryByLabelText(/Room code/)).toBeNull();
      expect(view.queryByRole("button", { name: /Copy code/ })).toBeNull();
      expect(view.queryByRole("button", { name: /Copy invite link/ })).toBeNull();
      view.unmount();
    }
  });

  it("gives the online board back once the match is really under way", () => {
    mocks.usePeerRoom.mockReturnValue(
      makePeer({
        status: "reconnecting",
        queue: "matched",
        message: "Socket dropped",
        gameState: {
          ...freshGameState(),
          gameMode: GameModes.ONLINE,
          gameStatus: GameStatus.ACTIVE,
        },
      }),
    );
    const view = render(
      <OnlineGameSurface config={quickConfig} onExit={vi.fn()} />,
    );

    const cell = view.getByRole("button", { name: /Row 1 column 1/ });
    expect((cell as HTMLButtonElement).disabled).toBe(true);
    view.getByRole("toolbar", { name: "Game actions" });
  });
});
