"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";

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
  OnlineGameSurface: ({ onExit }: { onExit: () => void }) => (
    <button type="button" onClick={onExit}>
      Exit online game
    </button>
  ),
}));

const { default: App } = await import("./App");

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
});

afterEach(cleanup);

describe("online setup draft", () => {
  it("reopens the lobby on the online setup the player exited", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "Online" }));
    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Custom room code/ }), {
      target: { value: "friday-game" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Room" }));

    fireEvent.click(await screen.findByRole("button", { name: "Exit online game" }));

    expect(
      screen.getByRole("radio", { name: "Online" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Create" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      (screen.getByRole("textbox", { name: /Custom room code/ }) as HTMLInputElement)
        .value,
    ).toBe("friday-game");
    expect(screen.getByRole("button", { name: "Create Room" })).toBeTruthy();
  });

  it("starts from the URL invite on a fresh mount, not the draft", async () => {
    const first = render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "Online" }));
    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Custom room code/ }), {
      target: { value: "friday-game" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Room" }));
    fireEvent.click(await screen.findByRole("button", { name: "Exit online game" }));
    first.unmount();

    window.history.replaceState({}, "", "/?room=other-room");
    render(<App />);

    expect(
      screen.getByRole("radio", { name: "Online" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "Join" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      (screen.getByRole("textbox", { name: /Room code/ }) as HTMLInputElement).value,
    ).toBe("other-room");
  });
});
