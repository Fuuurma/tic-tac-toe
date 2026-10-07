// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OnlineGameSurface } from "./onlineGameSurface";
import { freshGameState, type GameState } from "@/game/logic";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
} from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";

// The surface's transport lives in usePeerRoom — that hook is the seam
// boundary, so tests mock it and drive the exact renderable state a real
// connected session produces (a guest at a terminal board, etc.).
const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
  recordWin: vi.fn(),
  recordLoss: vi.fn(),
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
// The orbs animate on canvas, which jsdom does not implement.
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// PlayersPanel measures itself in useLayoutEffect; jsdom has no
// ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

afterEach(cleanup);

function terminalOnlineGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
    moveCount: 5,
  };
}

function makePeer(
  role: "host" | "guest",
  stateOverrides: Partial<PeerRoomState> = {},
) {
  return {
    state: {
      role,
      status: "connected",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      queuePosition: null,
      gameState: terminalOnlineGame(),
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

const config = {
  displayName: "Player",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  gameMode: GameModes.ONLINE,
  onlineRoomId: "ROOM42",
  onlineAction: "join" as const,
};

describe("OnlineGameSurface terminal rematch affordances", () => {
  it("offers Play again to a guest too — either side may ask", () => {
    // This used to be host-only: a guest's accept was dropped unless the
    // host had asked first, so a guest could never start a rematch.
    mocks.usePeerRoom.mockReturnValue(makePeer("guest"));
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    screen.getByRole("button", { name: "Play again" });
    expect(
      screen.queryByRole("button", { name: "Start a new game" }),
    ).toBeNull();
  });

  it("renders the icon Play again button for the host", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer("host"));
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    screen.getByRole("button", { name: "Play again" });
  });

  it("shows the labeled prompt to either side when a request is pending", () => {
    for (const role of ["host", "guest"] as const) {
      const view = render(
        <OnlineGameSurface config={config} onExit={vi.fn()} />,
      );
      mocks.usePeerRoom.mockReturnValue(
        makePeer(role, { rematchIncoming: true }),
      );
      view.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);

      screen.getByRole("button", { name: "Accept rematch" });
      // Answering a prompt and asking for one at the same time would
      // leave both sides waiting, so the ask button steps aside.
      expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
      view.unmount();
    }
  });

  it("lets a guest decline, and lets the asker cancel", () => {
    const incoming = render(
      <OnlineGameSurface config={config} onExit={vi.fn()} />,
    );
    mocks.usePeerRoom.mockReturnValue(
      makePeer("guest", { rematchIncoming: true }),
    );
    incoming.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    screen.getByRole("button", { name: "Decline rematch" });
    incoming.unmount();

    mocks.usePeerRoom.mockReturnValue(
      makePeer("guest", { rematchOutgoing: true }),
    );
    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    screen.getByRole("button", { name: "Cancel rematch" });
  });
});

describe("OnlineGameSurface result recording (F474)", () => {
  // F474: the result dedupe keyed on moveCount, which is host-controlled —
  // a host resending the same terminal frame with a different accepted
  // moveCount inflated the guest's local tally. The latch must hold one
  // result per terminal episode and re-arm only on a genuinely live frame.
  const liveGame = (): GameState => ({
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.ACTIVE,
  });

  it("repeated terminal frames with different accepted moveCounts record one result", () => {
    mocks.recordLoss.mockClear();
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    const { rerender } = render(
      <OnlineGameSurface config={config} onExit={vi.fn()} />,
    );
    expect(mocks.recordLoss).toHaveBeenCalledTimes(1);

    for (const moveCount of [6, 3, 9]) {
      peer.state = {
        ...peer.state,
        gameState: { ...peer.state.gameState, moveCount },
      };
      rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    }
    expect(mocks.recordLoss).toHaveBeenCalledTimes(1);
  });

  it("a reconnect replay of the terminal result adds nothing, then a new round counts once", () => {
    mocks.recordLoss.mockClear();
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    const { rerender } = render(
      <OnlineGameSurface config={config} onExit={vi.fn()} />,
    );
    // Identical frame replayed (state_snapshot resync) — still one result.
    peer.state = { ...peer.state, gameState: { ...peer.state.gameState } };
    rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(mocks.recordLoss).toHaveBeenCalledTimes(1);

    // Rematch lands a fresh ACTIVE round, then a new terminal — counts again.
    peer.state = { ...peer.state, gameState: liveGame() };
    rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    peer.state = { ...peer.state, gameState: terminalOnlineGame() };
    rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(mocks.recordLoss).toHaveBeenCalledTimes(2);
  });
});
