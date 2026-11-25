"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import {
  readOnlineSession,
  writeOnlineSession,
  type OnlineSessionDraft,
} from "@/lib/onlineSession";
import { Color, GameModes, SymbolShape } from "@/game/constants";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: null,
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

const mocks = vi.hoisted(() => ({ onlineSurfaceConfig: vi.fn() }));

vi.mock("@/components/game/onlineGameSurface", () => ({
  OnlineGameSurface: ({
    config,
    onExit,
  }: {
    config: {
      displayName: string;
      color: string;
      playerShape: string;
      gameMode: string;
      onlineRoomId: string;
      onlineAction: string;
      resumeRole?: string;
    };
    onExit: () => void;
  }) => {
    mocks.onlineSurfaceConfig(config);
    return (
      <button type="button" onClick={onExit}>
        Exit online game
      </button>
    );
  },
}));

const { default: App } = await import("./App");

const guestSession: OnlineSessionDraft = {
  roomId: "room-abc123",
  role: "guest",
  onlineAction: "join",
  displayName: "Maria",
  color: Color.PINK,
  playerShape: SymbolShape.STAR,
};

const lastSurfaceConfig = () =>
  mocks.onlineSurfaceConfig.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
  mocks.onlineSurfaceConfig.mockClear();
});

afterEach(cleanup);

describe("online room resume after reload", () => {
  it("mounts the online surface directly for a stored guest session", async () => {
    writeOnlineSession(guestSession);
    render(<App />);

    await screen.findByRole("button", { name: "Exit online game" });

    expect(lastSurfaceConfig()).toEqual(
      expect.objectContaining({
        gameMode: GameModes.ONLINE,
        onlineRoomId: "room-abc123",
        onlineAction: "join",
        resumeRole: "guest",
        displayName: "Maria",
        color: Color.PINK,
        playerShape: SymbolShape.STAR,
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Get started" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit your player settings" }),
    ).toBeNull();
  });

  it("keeps a quick-match guest on the hidden-room-code path", async () => {
    writeOnlineSession({ ...guestSession, onlineAction: "quick", roomId: "qm-room-9" });
    render(<App />);

    await screen.findByRole("button", { name: "Exit online game" });

    expect(lastSurfaceConfig()).toEqual(
      expect.objectContaining({
        onlineRoomId: "qm-room-9",
        onlineAction: "quick",
        resumeRole: "guest",
      }),
    );
  });

  it("lets an explicit room invite win over the stored session", async () => {
    writeOnlineSession(guestSession);
    window.history.replaceState({}, "", "/?room=invite-room");
    render(<App />);

    expect(
      (await screen.findByLabelText(/^Room code/) as HTMLInputElement).value,
    ).toBe("invite-room");
    expect(
      screen.getByRole("radio", { name: "Join" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(mocks.onlineSurfaceConfig).not.toHaveBeenCalled();
    expect(readOnlineSession()?.roomId).toBe("room-abc123");
  });

  it("ignores a stored host session instead of reseating it", async () => {
    writeOnlineSession({ ...guestSession, role: "host" });
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Edit your player settings" }),
    ).toBeTruthy();
    expect(mocks.onlineSurfaceConfig).not.toHaveBeenCalled();
    expect(readOnlineSession()?.role).toBe("host");
  });

  it("forgets the session on a deliberate exit and returns to the lobby", async () => {
    writeOnlineSession(guestSession);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Exit online game" }));

    expect(readOnlineSession()).toBeNull();
    expect(
      await screen.findByRole("button", { name: "Edit your player settings" }),
    ).toBeTruthy();
  });
});
