"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import {
  Color,
  GameModes,
  GameStatus,
  PlayerSymbol,
  SymbolShape,
} from "@/game/constants";
import { freshGameState } from "@/game/logic";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import {
  ONLINE_SESSION_KEY,
  ONLINE_SESSION_VERSION,
  readOnlineSession,
  type OnlineSession,
} from "@/lib/onlineSession";

const mocks = vi.hoisted(() => ({
  usePeerRoom: vi.fn(),
}));

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: null,
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

vi.mock("@/hooks/usePeerRoom", () => ({
  usePeerRoom: mocks.usePeerRoom,
}));

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const { default: App } = await import("./App");

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
      gameState: {
        ...freshGameState(),
        gameMode: GameModes.ONLINE,
        gameStatus: GameStatus.ACTIVE,
        moveCount: 3,
      },
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
    closeTransport: vi.fn(),
    updatePendingSettings: vi.fn(),
    setPaused: vi.fn(),
    paused: false,
  };
}

const guestSession: OnlineSession = {
  version: ONLINE_SESSION_VERSION,
  roomId: "ROOM42",
  role: "guest",
  onlineAction: "join",
  displayName: "Ada",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
  resultRecorded: false,
};

const store = (session: unknown): void => {
  window.sessionStorage.setItem(ONLINE_SESSION_KEY, JSON.stringify(session));
};

const lobbyIsOpen = (): boolean =>
  screen.queryByRole("heading", { name: /Tic Tac Toe Disappear/ }) !== null;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
  mocks.usePeerRoom.mockReset();
  mocks.usePeerRoom.mockReturnValue(makePeer("guest"));
});

afterEach(cleanup);

describe("reloading into an online room", () => {
  it("reopens the stored guest room and reseats it as a guest", async () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    store(guestSession);

    render(<App />);

    await waitFor(() => expect(peer.joinAsGuest).toHaveBeenCalledWith("ROOM42"));
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
    expect(peer.startAsHost).not.toHaveBeenCalled();
    expect(lobbyIsOpen()).toBe(false);
  });

  it("reseats a stored quick match in its room instead of searching again", async () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    store({ ...guestSession, onlineAction: "quick", roomId: "quick-room-42" });

    render(<App />);

    await waitFor(() => expect(peer.joinAsGuest).toHaveBeenCalledWith("quick-room-42"));
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
  });

  it("lets an explicit invite win over the stored session", async () => {
    store(guestSession);
    window.history.replaceState({}, "", "/?room=invite-room");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Tic Tac Toe Disappear/ }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement).value,
    ).toBe("invite-room");
  });

  it("ignores a stored host session (host restore is a separate slice)", async () => {
    const peer = makePeer("host");
    mocks.usePeerRoom.mockReturnValue(peer);
    store({ ...guestSession, role: "host" });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Tic Tac Toe Disappear/ }),
    ).toBeTruthy();
    expect(peer.joinAsGuest).not.toHaveBeenCalled();
  });

  it("ignores a malformed session", async () => {
    window.sessionStorage.setItem(ONLINE_SESSION_KEY, "{not json");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Tic Tac Toe Disappear/ }),
    ).toBeTruthy();
  });

  it("clears the session on a deliberate Leave and returns to the lobby", async () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    store(guestSession);

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Leave game" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leave" }));

    await waitFor(() => expect(lobbyIsOpen()).toBe(true));
    expect(readOnlineSession()).toBeNull();
    expect(peer.leave).toHaveBeenCalledTimes(1);
  });

  it("opens the lobby on the next load after a deliberate Leave", async () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    store(guestSession);

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Leave game" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leave" }));
    await waitFor(() => expect(lobbyIsOpen()).toBe(true));
    cleanup();

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Tic Tac Toe Disappear/ }),
    ).toBeTruthy();
  });

  it("keeps a quick match's room id out of the lobby draft and the room inputs", async () => {
    const peer = makePeer("guest");
    mocks.usePeerRoom.mockReturnValue(peer);
    store({ ...guestSession, onlineAction: "quick", roomId: "quick-room-42" });

    render(<App />);
    await waitFor(() => expect(peer.joinAsGuest).toHaveBeenCalledWith("quick-room-42"));
    fireEvent.click(await screen.findByRole("button", { name: "Leave game" }));
    fireEvent.click(await screen.findByRole("button", { name: "Leave" }));
    await waitFor(() => expect(lobbyIsOpen()).toBe(true));

    fireEvent.click(screen.getByRole("radio", { name: "Online" }));
    fireEvent.click(screen.getByRole("radio", { name: "Join" }));
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement).value,
    ).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect(
      (screen.getByRole("textbox", { name: /Custom room code/ }) as HTMLInputElement)
        .value,
    ).toBe("");
  });
});
