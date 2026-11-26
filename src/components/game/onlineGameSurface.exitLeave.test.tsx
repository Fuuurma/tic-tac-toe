"@vitest-environment jsdom";

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
}));

vi.mock("@/hooks/usePeerRoom", () => ({
  usePeerRoom: mocks.usePeerRoom,
}));
vi.mock("@/hooks/useGameStats", () => ({
  useGameStats: () => ({
    recordWin: vi.fn(),
    recordLoss: vi.fn(),
  }),
}));
vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));
vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({ count: null, refresh: () => {} }),
}));

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

afterEach(() => {
  cleanup();
});

function terminalOnlineGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.X,
    moveCount: 5,
  };
}

function liveOnlineGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.ACTIVE,
    moveCount: 3,
  };
}

function waitingGame(): GameState {
  return { ...freshGameState(), gameMode: GameModes.ONLINE };
}

function makePeer(
  role: "host" | "guest",
  stateOverrides: Partial<PeerRoomState> = {},
) {
  return {
    state: {
      role,
      status: "connected",
      queue: "none",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: false,
      gameState: terminalOnlineGame(),
      ...stateOverrides,
    } as PeerRoomState,
    startAsHost: vi.fn(),
    startQuickMatch: vi.fn(),
    joinAsGuest: vi.fn(),
    sendMove: vi.fn(),
    requestRematch: vi.fn(),
    acceptRematch: vi.fn(),
    declineRematch: vi.fn(),
    cancelRematch: vi.fn(),
    retryReconnect: vi.fn(),
    leave: vi.fn(),
    closeTransport: vi.fn(),
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

function expectLeaveBeforeExit(
  peer: ReturnType<typeof makePeer>,
  onExit: ReturnType<typeof vi.fn>,
) {
  expect(peer.leave).toHaveBeenCalledTimes(1);
  expect(onExit).toHaveBeenCalledTimes(1);
  expect(peer.leave.mock.invocationCallOrder[0]).toBeLessThan(
    onExit.mock.invocationCallOrder[0],
  );
}

describe("OnlineGameSurface exit paths tell the peer", () => {
  it("the header Leave on a finished game leaves the room, then exits", () => {
    const peer = makePeer("host");
    const onExit = vi.fn();
    mocks.usePeerRoom.mockReturnValue(peer);
    render(<OnlineGameSurface config={config} onExit={onExit} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));

    expectLeaveBeforeExit(peer, onExit);
  });

  it("the header Leave mid-game confirms first, then leaves the room and exits", () => {
    const peer = makePeer("host", { gameState: liveOnlineGame() });
    const onExit = vi.fn();
    mocks.usePeerRoom.mockReturnValue(peer);
    render(<OnlineGameSurface config={config} onExit={onExit} />);

    fireEvent.click(screen.getByRole("button", { name: "Leave game" }));
    expect(peer.leave).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Leave" }));

    expectLeaveBeforeExit(peer, onExit);
  });

  it("the connection-error banner exit leaves the room, then exits", () => {
    const peer = makePeer("guest", {
      status: "error",
      message: "Room connect failed",
      gameState: waitingGame(),
    });
    const onExit = vi.fn();
    mocks.usePeerRoom.mockReturnValue(peer);
    render(<OnlineGameSurface config={config} onExit={onExit} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));

    expectLeaveBeforeExit(peer, onExit);
  });

  it("the disconnected banner exit leaves the room, then exits", () => {
    const peer = makePeer("guest", {
      status: "disconnected",
      message: "Opponent left the room",
      canRetryReconnect: true,
      gameState: waitingGame(),
    });
    const onExit = vi.fn();
    mocks.usePeerRoom.mockReturnValue(peer);
    render(<OnlineGameSurface config={config} onExit={onExit} />);

    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));

    expectLeaveBeforeExit(peer, onExit);
  });

  it("unmounting without an exit click closes the transport for reconnect instead of leaving", () => {
    const peer = makePeer("host");
    mocks.usePeerRoom.mockReturnValue(peer);
    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    view.unmount();

    expect(peer.closeTransport).toHaveBeenCalledTimes(1);
    expect(peer.leave).not.toHaveBeenCalled();
  });
});
