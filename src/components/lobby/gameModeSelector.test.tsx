// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { GameModeSelector } from "./gameModeSelector";
import { GameModes } from "@/game/constants";

afterEach(cleanup);

describe("GameModeSelector", () => {
  it("keeps the full accessible mode name with a compact mobile label", () => {
    render(
      <GameModeSelector
        selectedMode={GameModes.VS_COMPUTER}
        onModeChange={vi.fn()}
      />,
    );

    const computerMode = screen.getByRole("radio", { name: "vs Computer" });
    expect(computerMode.getAttribute("aria-checked")).toBe("true");
    expect(computerMode.textContent).toContain("AI");
    expect(computerMode.textContent).toContain("Computer");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("points aria-describedby at each mode's visible description", () => {
    render(
      <GameModeSelector
        selectedMode={GameModes.VS_COMPUTER}
        onModeChange={vi.fn()}
      />,
    );

    for (const [name, description] of [
      ["vs Computer", "Practice with AI"],
      ["vs Friend", "Pass and play"],
      ["Online", "Play remotely"],
    ]) {
      const radio = screen.getByRole("radio", { name });
      const descId = radio.getAttribute("aria-describedby");
      const descEl = descId ? document.getElementById(descId) : null;
      expect(descEl?.textContent).toContain(description);
    }
  });
});
