// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

afterEach(cleanup);

describe("LobbyForm online options", () => {
  it("points aria-describedby at each option's visible description", () => {
    render(<LobbyForm onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Online" }));

    for (const [name, description] of [
      ["Quick", "Auto-match"],
      ["Create", "New room"],
      ["Join", "Enter code"],
    ]) {
      const radio = screen.getByRole("radio", { name });
      const descId = radio.getAttribute("aria-describedby");
      const descEl = descId ? document.getElementById(descId) : null;
      expect(descEl?.textContent).toContain(description);
    }
  });
});

// Local dev has no VITE_MATCHMAKING_URL by default: the relay falls back to
// 127.0.0.1:8787, so Create and Join stay usable. Only Quick Match, which
// needs the matchmaking HTTP service, is disabled.
describe("LobbyForm online entry points in local dev", () => {
  it("keeps Create Room enabled and sends Quick Match users there", () => {
    render(<LobbyForm onStart={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Online" }));

    fireEvent.click(screen.getByRole("radio", { name: "Create" }));
    expect((screen.getByRole("button", { name: "Create Room" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "Quick" }));
    const quick = screen.getByRole("button", { name: "Quick Match" }) as HTMLButtonElement;
    expect(quick.disabled).toBe(true);
    const reasonId = quick.getAttribute("aria-describedby");
    expect(reasonId && document.getElementById(reasonId)?.textContent).toBe(
      "Online play isn't available in this build. Create or join a room instead.",
    );
  });
});
