// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

// A configured build whose relay never answers: no poll has ever
// succeeded, so the Online tile disables with the reason instead of
// offering dead Quick/Create/Join actions.
vi.mock("@/lib/matchmaking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/matchmaking")>()),
  MATCHMAKING_CONFIGURED: true,
  ONLINE_UNAVAILABLE: false,
  fetchMatchmakingHealth: vi.fn(async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:8787");
  }),
}));

afterEach(cleanup);

const DOWN_REASON =
"Online mode isn't available. Try again later.";

describe("LobbyForm with an unreachable relay", () => {
  it("starts enabled while reachability is unknown", () => {
    render(<LobbyForm onStart={vi.fn()} />);

    // The first poll is still in flight: unknown reads as enabled, never
    // flickering. The failure below flips it.
    expect(
      (screen.getByRole("radio", { name: "Online" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("marks the Online tile unavailable once the relay proves unreachable", async () => {
    render(<LobbyForm onStart={vi.fn()} />);

    const online = screen.getByRole("radio", { name: "Online" });
    await waitFor(() => expect(online.getAttribute("aria-disabled")).toBe("true"));
    // Nothing nags until tapped, even after the failure lands.
    expect(screen.queryByText(DOWN_REASON)).toBeNull();

    fireEvent.click(online);
    expect(screen.getByText(DOWN_REASON)).toBeTruthy();
  });

  it("falls back to Computer on an invite link once down is proven", async () => {
    render(<LobbyForm initialRoomId="friday-game" onStart={vi.fn()} />);

    const online = screen.getByRole("radio", { name: "Online" });
    await waitFor(() => expect(online.getAttribute("aria-disabled")).toBe("true"));
    expect(
      (screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
