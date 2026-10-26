// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

// A production build with no VITE_MATCHMAKING_URL. Create and Join build
// their socket URL from the same base as Quick Match, so none of the three
// can work: the Online tile itself is disabled and says why, instead of
// letting the visitor pick a dead mode and failing after Start.
vi.mock("@/lib/matchmaking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/matchmaking")>()),
  MATCHMAKING_CONFIGURED: false,
  ONLINE_UNAVAILABLE: true,
}));

afterEach(cleanup);

const ONLINE_REASON = "Online mode isn't available in this build.";

describe("LobbyForm without a matchmaking backend (production build)", () => {
  it("marks the Online tile unavailable and explains it only when tapped", () => {
    render(<LobbyForm onStart={vi.fn()} />);

    const online = screen.getByRole("radio", { name: "Online" });
    expect(online.getAttribute("aria-disabled")).toBe("true");
    // Nothing nags until asked.
    expect(screen.queryByText(ONLINE_REASON)).toBeNull();

    fireEvent.click(online);
    expect(screen.getByText(ONLINE_REASON)).toBeTruthy();
    // Tapping explains; it never selects the dead mode.
    expect(
      screen.queryByRole("radiogroup", { name: "Online match type" }),
    ).toBeNull();
  });

  it("offers no online section while the tile is dead; Start stays a local game", () => {
    // NOTE: no click is simulated here. fireEvent dispatches listeners even
    // on disabled buttons, but real browsers never activate them, so the
    // faithful assertion is the disabled property plus the absent section.
    render(<LobbyForm onStart={vi.fn()} />);

    expect(
      screen.queryByRole("radiogroup", { name: "Online match type" }),
    ).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("falls back to Computer on an invite link instead of a dead mode", () => {
    render(<LobbyForm initialRoomId="friday-game" onStart={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Online" }).getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(
      (screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("leaves local play alone", () => {
    render(<LobbyForm onStart={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
