// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

// A production build with no VITE_MATCHMAKING_URL. Create and Join build
// their socket URL from the same base as Quick Match, so none of the three
// can work: the lobby must say so instead of failing after the click.
vi.mock("@/lib/matchmaking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/matchmaking")>()),
  MATCHMAKING_CONFIGURED: false,
  ONLINE_UNAVAILABLE: true,
}));

afterEach(cleanup);

const UNAVAILABLE = "Online play isn't available in this build.";

/** The text the button's aria-describedby points at (no jest-dom here). */
function describedBy(button: HTMLElement) {
  const id = button.getAttribute("aria-describedby");
  return id ? document.getElementById(id)?.textContent : undefined;
}

function openOnline(action: "Quick" | "Create" | "Join") {
  render(<LobbyForm onStart={vi.fn()} />);
  fireEvent.click(screen.getByRole("radio", { name: "Online" }));
  fireEvent.click(screen.getByRole("radio", { name: action }));
}

describe("LobbyForm without a matchmaking backend (production build)", () => {
  it("disables Create Room and says why", () => {
    openOnline("Create");
    const start = screen.getByRole("button", { name: "Create Room" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(describedBy(start)).toBe(UNAVAILABLE);
  });

  it("disables Join Room even with a valid code", () => {
    openOnline("Join");
    fireEvent.change(screen.getByPlaceholderText("e.g. friday-game"), {
      target: { value: "friday-game" },
    });
    const start = screen.getByRole("button", { name: "Join Room" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(describedBy(start)).toBe(UNAVAILABLE);
  });

  it("does not tell Quick Match users to create or join instead", () => {
    openOnline("Quick");
    const start = screen.getByRole("button", { name: "Quick Match" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(describedBy(start)).toBe(UNAVAILABLE);
  });

  it("leaves local play alone", () => {
    render(<LobbyForm onStart={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
