"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";

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

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: { players: 2, waiting: 1 },
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

const surfaceSpy = vi.hoisted(() => ({
  props: null as {
    config: Record<string, unknown>;
    onExit: () => void;
  } | null,
}));

vi.mock("@/components/game/onlineGameSurface", () => ({
  OnlineGameSurface: (props: {
    config: Record<string, unknown>;
    onExit: () => void;
  }) => {
    surfaceSpy.props = props;
    return (
      <button type="button" onClick={props.onExit}>
        Exit online game
      </button>
    );
  },
}));

const { default: App } = await import("./App");

const SESSION_KEY = "tic-tac-toe:online-session";

const seedSession = (overrides: Record<string, unknown> = {}) => {
  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      version: 1,
      roomId: "ROOM42",
      role: "guest",
      onlineAction: "join",
      displayName: "Maria",
      color: "blue",
      playerShape: "X",
      ...overrides,
    }),
  );
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
  surfaceSpy.props = null;
});

afterEach(cleanup);

describe("online reload resume", () => {
  it("reopens a stored guest session directly into the online game", async () => {
    seedSession();
    render(<App />);

    await screen.findByRole("button", { name: "Exit online game" });

    expect(surfaceSpy.props?.config).toMatchObject({
      gameMode: "ONLINE",
      onlineRoomId: "ROOM42",
      onlineAction: "join",
      resumeRole: "guest",
      displayName: "Maria",
      color: "blue",
      playerShape: "X",
    });
    expect(screen.queryByRole("radio", { name: "Online" })).toBeNull();
  });

  it("lets an explicit ?room= invite win over a stored session", async () => {
    seedSession();
    window.history.replaceState({}, "", "/?room=invite-room");
    render(<App />);

    expect(
      await screen.findByRole("radio", { name: "Join" }),
    ).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("invite-room");
    expect(surfaceSpy.props).toBeNull();
  });

  it("clears the session and returns to the lobby on deliberate exit", async () => {
    seedSession();
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Exit online game" }),
    );

    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
  });

  it("ignores a stored host session — the ordinary lobby path runs", async () => {
    seedSession({ role: "host" });
    render(<App />);

    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
    expect(surfaceSpy.props).toBeNull();
  });

  it("ignores a malformed stored session", async () => {
    window.sessionStorage.setItem(SESSION_KEY, "{bad json");
    render(<App />);

    expect(
      await screen.findByRole("radio", { name: "Online" }),
    ).toBeTruthy();
    expect(surfaceSpy.props).toBeNull();
  });

  it("never leaks a resumed quick match's internal room id into the lobby draft", async () => {
    seedSession({ onlineAction: "quick", roomId: "QM-SECRET-9" });
    render(<App />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Exit online game" }),
    );

    expect(screen.queryByText("QM-SECRET-9")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Join" }));
    expect(screen.queryByText("QM-SECRET-9")).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement)
        .value,
    ).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect(screen.queryByText("QM-SECRET-9")).toBeNull();
    expect(
      (
        screen.getByRole("textbox", {
          name: /Custom room code/,
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });
});
