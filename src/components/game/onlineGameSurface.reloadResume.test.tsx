"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import {
  ONLINE_SESSION_KEY,
  ONLINE_SESSION_VERSION,
  readOnlineSession,
  type OnlineSession,
} from "@/lib/onlineSession";

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

function winningGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.COMPLETED,
    winner: PlayerSymbol.O,
    moveCount: 5,
  };
}

function liveGame(): GameState {
  return {
    ...freshGameState(),
    gameMode: GameModes.ONLINE,
    gameStatus: GameStatus.ACTIVE,
    moveCount: 3,
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
      queue: "none",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: false,
      gameState: winningGame(),
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

const storedSession = (overrides: Partial<OnlineSession> = {}): OnlineSession => ({
  version: ONLINE_SESSION_VERSION,
  roomId: "ROOM42",
  role: "guest",
  onlineAction: "join",
  displayName: "Player",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  resultRecorded: false,
  ...overrides,
});

const store = (session: OnlineSession): void => {
  window.sessionStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
};

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.recordWin.mockClear();
  mocks.recordLoss.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("OnlineGameSurface reload resume", () => {
  it("reseats a guest resume through joinAsGuest, never startQuickMatch", () => {
    const peer = makePeer("guest", { status: "connecting", gameState: freshGameState() });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(
      <OnlineGameSurface
        config={{ ...config, onlineAction: "quick", resumeRole: "guest" }}
        onExit={vi.fn()}
      />,
    );

    expect(peer.joinAsGuest).toHaveBeenCalledWith("ROOM42");
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
    expect(peer.startAsHost).not.toHaveBeenCalled();
  });

  it("writes the session once the room has an id and a role", () => {
    mocks.usePeerRoom.mockReturnValue(makePeer("guest"));

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(readOnlineSession()).toMatchObject({
      roomId: "ROOM42",
      role: "guest",
      onlineAction: "join",
      displayName: "Player",
      color: Color.BLUE,
      playerShape: SymbolShape.X,
    });
  });

  it("does not count a result the stored session already counted", () => {
    store(storedSession({ resultRecorded: true }));
    mocks.usePeerRoom.mockReturnValue(
      makePeer("guest", { gameState: winningGame() }),
    );

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(mocks.recordWin).not.toHaveBeenCalled();
    expect(mocks.recordLoss).not.toHaveBeenCalled();
  });

  it("counts a game that finished while the guest was reloading, once", () => {
    store(storedSession({ resultRecorded: false }));
    mocks.usePeerRoom.mockReturnValue(
      makePeer("guest", { gameState: winningGame() }),
    );

    render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(mocks.recordWin).toHaveBeenCalledTimes(1);
  });

  it("keeps the counted result in the session, and clears it for the next round", () => {
    store(storedSession({ resultRecorded: false }));
    const peer = makePeer("guest", { gameState: winningGame() });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(readOnlineSession()?.resultRecorded).toBe(true);

    peer.state = { ...peer.state, gameState: liveGame() };
    view.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(readOnlineSession()?.resultRecorded).toBe(false);
  });

  it("does not count a second time when the same finished game is replayed", () => {
    const peer = makePeer("guest", { gameState: winningGame() });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(mocks.recordWin).toHaveBeenCalledTimes(1);

    peer.state = { ...peer.state, gameState: { ...peer.state.gameState } };
    view.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(mocks.recordWin).toHaveBeenCalledTimes(1);
  });

  it("clears the session on a terminal disconnect", () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);
    expect(readOnlineSession()).not.toBeNull();

    peer.state = {
      ...peer.state,
      status: "disconnected",
      canRetryReconnect: false,
    };
    view.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(readOnlineSession()).toBeNull();
  });

  it("keeps the session through a retryable disconnect", () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    peer.state = {
      ...peer.state,
      status: "disconnected",
      canRetryReconnect: true,
    };
    view.rerender(<OnlineGameSurface config={config} onExit={vi.fn()} />);

    expect(readOnlineSession()).toMatchObject({ roomId: "ROOM42" });
  });

  it("clears the session on a deliberate exit", () => {
    const onExit = vi.fn();
    const peer = makePeer("host", {
      status: "waiting",
      roomId: "FRIDAY-9",
      gameState: freshGameState(),
    });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(
      <OnlineGameSurface config={{ ...config, onlineAction: "create" }} onExit={onExit} />,
    );
    expect(readOnlineSession()).toMatchObject({ roomId: "FRIDAY-9" });

    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));

    expect(peer.leave).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(readOnlineSession()).toBeNull();
  });
});
