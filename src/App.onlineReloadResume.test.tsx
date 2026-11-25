"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  GameModes,
  GameStatus,
  PlayerSymbol,
} from "@/game/constants";
import { freshGameState } from "@/game/logic";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import type { PeerRoomState } from "@/hooks/usePeerRoom";

const dom = Reflect.get(globalThis, "jsdom") as
  | { window: { sessionStorage: Storage } }
  | undefined;
if (typeof window !== "undefined" && dom) {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: dom.window.sessionStorage,
  });
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
}));

vi.mock("@/hooks/usePeerRoom", () => ({
  usePeerRoom: mocks.usePeerRoom,
}));

vi.mock("@/components/backgroundPattern", () => ({
  BackgroundPattern: () => null,
}));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: { players: 2, waiting: 1 },
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

vi.mock("@/hooks/useGameStats", () => ({
  useGameStats: () => ({
    stats: {},
    recordWin: vi.fn(),
    recordLoss: vi.fn(),
  }),
}));

vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const { default: App } = await import("./App");

const SESSION_KEY = "tic-tac-toe:online-session";

function seedSession(overrides: Record<string, unknown> = {}) {
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      version: 1,
      roomId: "room-abc123",
      role: "guest",
      onlineAction: "join",
      displayName: "Maria",
      color: "pink",
      playerShape: "star",
      ...overrides,
    }),
  );
}

function makePeer(stateOverrides: Partial<PeerRoomState> = {}) {
  return {
    state: {
      role: "guest",
      status: "connecting",
      queue: "none",
      roomId: "room-abc123",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: false,
      gameState: {
        ...freshGameState(),
        gameMode: GameModes.ONLINE,
        gameStatus: GameStatus.WAITING,
      },
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
    hostPaused: false,
    reaction: null,
    sendReaction: vi.fn(),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("online reload resume", () => {
  it("mounts the online surface directly for a stored guest session", async () => {
    seedSession();
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    expect(screen.queryByRole("radio", { name: "Online" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();
    await screen.findByText("Joining room…");
    await waitFor(() =>
      expect(peer.joinAsGuest).toHaveBeenCalledWith("room-abc123"),
    );
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
    expect(peer.startAsHost).not.toHaveBeenCalled();
  });

  it("resumes a quick-match session by room id, never by restarting the search", async () => {
    seedSession({ onlineAction: "quick", roomId: "qm-internal-9" });
    const peer = makePeer({
      roomId: "qm-internal-9",
      gameState: {
        ...freshGameState(),
        gameMode: GameModes.ONLINE,
        gameStatus: GameStatus.WAITING,
      },
    });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    await waitFor(() =>
      expect(peer.joinAsGuest).toHaveBeenCalledWith("qm-internal-9"),
    );
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
    expect(peer.startAsHost).not.toHaveBeenCalled();
  });

  it("lets an explicit ?room= invite win over the stored session", async () => {
    seedSession();
    window.history.replaceState({}, "", "/?room=invited-room");
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("invited-room");
    expect(peer.joinAsGuest).not.toHaveBeenCalled();
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
  });

  it("clears the session on deliberate exit and returns to the lobby", async () => {
    seedSession({ onlineAction: "quick", roomId: "qm-internal-9" });
    const peer = makePeer({ roomId: "qm-internal-9" });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);
    await screen.findByText("Joining room…");

    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));

    expect(peer.leave).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
  });

  it("never leaks a quick match's internal room id into the lobby draft", async () => {
    seedSession({ onlineAction: "quick", roomId: "qm-internal-9" });
    const peer = makePeer({ roomId: "qm-internal-9" });
    mocks.usePeerRoom.mockReturnValue(peer);

    const view = render(<App />);
    await screen.findByText("Joining room…");
    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
    await screen.findByRole("radio", { name: "Online" });

    expect(document.body.innerHTML).not.toContain("qm-internal-9");

    fireEvent.click(screen.getByRole("radio", { name: "Join" }));
    expect(document.body.innerHTML).not.toContain("qm-internal-9");
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect(document.body.innerHTML).not.toContain("qm-internal-9");
    expect(
      (screen.getByRole("textbox", { name: /Custom room code/ }) as HTMLInputElement)
        .value,
    ).toBe("");
    view.unmount();
  });

  it("keeps a create/join room id in the lobby draft after exit", async () => {
    seedSession({ onlineAction: "join", roomId: "room-abc123" });
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);
    await screen.findByText("Joining room…");
    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));
    await screen.findByRole("radio", { name: "Online" });

    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("room-abc123");
  });

  it("takes the ordinary first-run path for a stored host session", async () => {
    seedSession({ role: "host", onlineAction: "create" });
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
    expect(peer.startAsHost).not.toHaveBeenCalled();
    expect(peer.joinAsGuest).not.toHaveBeenCalled();
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
  });

  it("takes the ordinary first-run path for a malformed session", async () => {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ version: 1, roomId: "  padded  " }),
    );
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
    expect(peer.joinAsGuest).not.toHaveBeenCalled();
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
  });
});
