import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { builtinEnvironments } from "vitest/runtime";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { freshGameState, type GameState } from "@/game/logic";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
} from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import {
  readOnlineSession,
  writeOnlineSession,
  type OnlineSession,
} from "@/lib/onlineSession";
import App from "./App";

let teardownEnvironment: (() => unknown) | undefined;

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  await teardownEnvironment?.();
});

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const activeOnlineGame = (): GameState => ({
  ...freshGameState(),
  gameMode: GameModes.ONLINE,
  gameStatus: GameStatus.ACTIVE,
});

const terminalOnlineGame = (): GameState => ({
  ...freshGameState(),
  gameMode: GameModes.ONLINE,
  gameStatus: GameStatus.COMPLETED,
  winner: PlayerSymbol.X,
  moveCount: 5,
});

function makePeer(stateOverrides: Partial<PeerRoomState> = {}) {
  return {
    state: {
      role: "guest",
      status: "connected",
      queue: "none",
      roomId: "guest-room-1",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: false,
      gameState: activeOnlineGame(),
      ...stateOverrides,
    } as PeerRoomState,
    startAsHost: vi.fn(),
    startQuickMatch: vi.fn(),
    joinAsGuest: vi.fn(),
    acceptRematch: vi.fn(),
    sendMove: vi.fn(),
    requestRematch: vi.fn(),
    declineRematch: vi.fn(),
    cancelRematch: vi.fn(),
    retryReconnect: vi.fn(),
    leave: vi.fn(),
    updatePendingSettings: vi.fn(),
    setPaused: vi.fn(),
    paused: false,
    hostPaused: false,
    reaction: null,
    sendReaction: vi.fn(),
  };
}

const seedGuestSession = (overrides: Partial<OnlineSession> = {}) =>
  writeOnlineSession({
    roomId: "guest-room-1",
    role: "guest",
    onlineAction: "quick",
    displayName: "Maria",
    color: Color.PINK,
    playerShape: SymbolShape.STAR,
    ...overrides,
  });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("rejoining an online room after a reload", () => {
  it("reopens the recorded guest room directly, with the stored identity", async () => {
    seedGuestSession();
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<App />);

    await view.findByRole("toolbar", { name: "Game actions" });
    expect(mocks.usePeerRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        hostDisplayName: "Maria",
        hostColor: Color.PINK,
        hostShape: SymbolShape.STAR,
        gameMode: GameModes.ONLINE,
      }),
    );
    expect(peer.joinAsGuest).toHaveBeenCalledWith("guest-room-1");
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
    expect(peer.startAsHost).not.toHaveBeenCalled();
    expect(view.queryByRole("button", { name: "Get started" })).toBeNull();
    expect(
      view.queryByRole("button", { name: "Edit your player settings" }),
    ).toBeNull();
    expect(view.queryByText("guest-room-1")).toBeNull();
    expect(readOnlineSession()).toMatchObject({
      roomId: "guest-room-1",
      role: "guest",
    });
  });

  it("lets an explicit room invite win over the stored session", async () => {
    seedGuestSession();
    window.history.replaceState({}, "", "/?room=other-room");
    mocks.usePeerRoom.mockReturnValue(makePeer());

    const view = render(<App />);

    expect(await view.findByRole("radio", { name: "Join" })).toBeTruthy();
    expect(
      (view.getByLabelText(/^Room code/) as HTMLInputElement).value,
    ).toBe("other-room");
    expect(mocks.usePeerRoom).not.toHaveBeenCalled();
  });

  it("ignores a stored host session rather than reseating a host", async () => {
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
    writeOnlineSession({
      roomId: "host-room-9",
      role: "host",
      onlineAction: "create",
      displayName: "Host",
      color: Color.BLUE,
      playerShape: SymbolShape.X,
    });
    mocks.usePeerRoom.mockReturnValue(makePeer());

    const view = render(<App />);

    expect(
      await view.findByRole("button", { name: "Edit your player settings" }),
    ).toBeTruthy();
    expect(mocks.usePeerRoom).not.toHaveBeenCalled();
  });

  it("forgets the session on a deliberate exit and returns to the lobby", async () => {
    seedGuestSession();
    const peer = makePeer({ gameState: terminalOnlineGame() });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<App />);

    fireEvent.click(await view.findByRole("button", { name: "Leave game" }));

    expect(peer.leave).toHaveBeenCalled();
    expect(readOnlineSession()).toBeNull();
    expect(
      await view.findByRole("button", { name: "Edit your player settings" }),
    ).toBeTruthy();
  });
});
