"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { freshGameState, type GameState } from "@/game/logic";
import { Color, GameModes, PlayerSymbol, SymbolShape } from "@/game/constants";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import { readOnlineSession, writeOnlineSession } from "@/lib/onlineSession";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const dom = Reflect.get(globalThis, "jsdom") as
  | { window: { sessionStorage: Storage } }
  | undefined;
if (typeof window !== "undefined" && dom) {
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: dom.window.sessionStorage,
  });
}

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
  usePlayerCount: () => ({
    count: mocks.playerCount,
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));
vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

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

const { default: App } = await import("./App");

function connectingGame(): GameState {
  return { ...freshGameState(), gameMode: GameModes.ONLINE };
}

function makePeer(stateOverrides: Partial<PeerRoomState> = {}) {
  return {
    state: {
      role: "guest",
      status: "connecting",
      queue: "none",
      roomId: "ROOM42",
      hostSymbol: PlayerSymbol.X,
      guestSymbol: PlayerSymbol.O,
      message: "",
      rematchIncoming: false,
      rematchOutgoing: false,
      leftBySelf: false,
      canRetryReconnect: false,
      gameState: connectingGame(),
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
    updatePendingSettings: vi.fn(),
    setPaused: vi.fn(),
    paused: false,
  };
}

const guestSession = {
  roomId: "ROOM42",
  role: "guest" as const,
  onlineAction: "join" as const,
  displayName: "Nova Fox",
  color: Color.PINK,
  playerShape: SymbolShape.STAR,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  mocks.usePeerRoom.mockReset();
});

afterEach(cleanup);

describe("online reload resume", () => {
  it("reopens the stored room directly, reseating the guest side", async () => {
    writeOnlineSession({ ...guestSession, onlineAction: "quick", roomId: "QM-RESUME" });
    const peer = makePeer({ roomId: "QM-RESUME" });
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    await screen.findByText("Joining room…");
    expect(mocks.usePeerRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        hostDisplayName: "Nova Fox",
        hostColor: Color.PINK,
        hostShape: SymbolShape.STAR,
      }),
    );
    expect(peer.joinAsGuest).toHaveBeenCalledWith("QM-RESUME");
    expect(peer.startQuickMatch).not.toHaveBeenCalled();
    expect(peer.startAsHost).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Get started" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit your player settings" }),
    ).toBeNull();
  });

  it("lets an explicit ?room= invite win over the stored session", () => {
    writeOnlineSession(guestSession);
    window.history.replaceState({}, "", "/?room=invite-room");

    render(<App />);

    expect(mocks.usePeerRoom).not.toHaveBeenCalled();
    expect(
      screen.getByRole("radio", { name: "Join" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      (screen.getByLabelText(/^Room code/) as HTMLInputElement).value,
    ).toBe("invite-room");
    expect(screen.queryByText("Joining room…")).toBeNull();
  });

  it("clears the session and returns to the lobby on a deliberate exit", async () => {
    writeOnlineSession(guestSession);
    const peer = makePeer();
    mocks.usePeerRoom.mockReturnValue(peer);

    render(<App />);

    await screen.findByText("Joining room…");
    fireEvent.click(screen.getByRole("button", { name: "Back to setup" }));

    expect(peer.leave).toHaveBeenCalled();
    expect(readOnlineSession()).toBeNull();
    expect(
      await screen.findByRole("button", { name: "Edit your player settings" }),
    ).toBeTruthy();
  });

  it("ignores a stored host session and takes the ordinary first-run path", () => {
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
    writeOnlineSession({
      ...guestSession,
      role: "host",
      onlineAction: "create",
      roomId: "HOST-ROOM",
    });

    render(<App />);

    expect(mocks.usePeerRoom).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Edit your player settings" }),
    ).toBeTruthy();
    expect(screen.queryByText("Joining room…")).toBeNull();
  });
});
