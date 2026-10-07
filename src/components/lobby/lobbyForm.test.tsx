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
