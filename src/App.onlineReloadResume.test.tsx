"@vitest-environment jsdom";


import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import { Color, SymbolShape } from "@/game/constants";
import {
  ONLINE_SESSION_KEY,
  ONLINE_SESSION_VERSION,
  readOnlineSession,
  type OnlineSession,
} from "@/lib/onlineSession";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: { players: 2, waiting: 1 },
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

vi.mock("@/components/game/onlineGameSurface", () => ({
  OnlineGameSurface: ({
    config,
    onExit,
  }: {
    config: {
      onlineRoomId: string;
      onlineAction: string;
      displayName: string;
      resumeRole?: string;
    };
    onExit: () => void;
  }) => (
    <div>
      <span data-testid="room-id">{config.onlineRoomId}</span>
      <span data-testid="online-action">{config.onlineAction}</span>
      <span data-testid="display-name">{config.displayName}</span>
      <span data-testid="resume-role">{config.resumeRole ?? ""}</span>
      <button type="button" onClick={onExit}>
        Exit online game
      </button>
    </div>
  ),
}));

const { default: App } = await import("./App");

const guestSession: OnlineSession = {
  version: ONLINE_SESSION_VERSION,
  roomId: "ROOM42",
  role: "guest",
  onlineAction: "join",
  displayName: "Ada",
  color: Color.BLUE,
  playerShape: SymbolShape.X,
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
});

afterEach(() => {
  cleanup();
});

describe("reloading into an online room", () => {
  it("opens the stored guest room directly, with the stored facts", async () => {
    store(guestSession);

    render(<App />);

    expect((await screen.findByTestId("room-id")).textContent).toBe("ROOM42");
    expect(screen.getByTestId("online-action").textContent).toBe("join");
    expect(screen.getByTestId("display-name").textContent).toBe("Ada");
    expect(screen.getByTestId("resume-role").textContent).toBe("guest");
    expect(lobbyIsOpen()).toBe(false);
  });

  it("lets an explicit invite win over the stored session", async () => {
    store(guestSession);
    window.history.replaceState({}, "", "/?room=invite-room");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /Tic Tac Toe Disappear/ })).toBeTruthy();
    expect(screen.queryByTestId("room-id")).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement).value,
    ).toBe("invite-room");
  });

  it("clears the session on a deliberate exit and returns to the lobby", async () => {
    store(guestSession);

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Exit online game" }));

    expect(readOnlineSession()).toBeNull();
    expect(lobbyIsOpen()).toBe(true);
  });

  it("ignores a malformed session", () => {
    window.sessionStorage.setItem(ONLINE_SESSION_KEY, "{not json");

    render(<App />);

    expect(screen.queryByTestId("room-id")).toBeNull();
    expect(lobbyIsOpen()).toBe(true);
  });

  it("ignores a host-role session (host restore is a separate slice)", () => {
    store({ ...guestSession, role: "host" });

    render(<App />);

    expect(screen.queryByTestId("room-id")).toBeNull();
    expect(lobbyIsOpen()).toBe(true);
  });

  it("keeps a quick match's room id out of the lobby draft and the room inputs", async () => {
    store({ ...guestSession, onlineAction: "quick", roomId: "quick-room-42" });

    render(<App />);
    expect((await screen.findByTestId("room-id")).textContent).toBe("quick-room-42");

    fireEvent.click(screen.getByRole("button", { name: "Exit online game" }));

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
