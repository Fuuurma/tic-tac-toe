// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LobbyForm } from "./lobbyForm";

afterEach(cleanup);

describe("LobbyForm online match type", () => {
  // The option buttons set aria-label to the label, which forms the
  // accessible name and would otherwise hide the description line that is
  // visible on screen. The description must still reach AT, the same way
  // GameModeSelector's mode descriptions do.
  it("points aria-describedby at each option's visible description", () => {
    // An initial room id puts the form straight into online mode, so the
    // three option radios render without driving the mode selector first.
    render(<LobbyForm initialRoomId="abcd" onStart={vi.fn()} />);

    for (const [name, description] of [
      ["Quick", "Auto-match"],
      ["Create", "New room"],
      ["Join", "Enter code"],
    ]) {
      const radio = screen.getByRole("radio", { name });
      const descId = radio.getAttribute("aria-describedby");
      expect(descId).toBeTruthy();
      const descEl = descId ? document.getElementById(descId) : null;
      expect(descEl?.textContent).toContain(description);
    }
  });
});