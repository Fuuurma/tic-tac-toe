// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AI_DifficultySelector } from "./aiDifficultySelector";
import { AI_Difficulty } from "@/game/constants";

describe("AI_DifficultySelector", () => {
  afterEach(cleanup);

  const openDifficultyPicker = () =>
    fireEvent.click(screen.getByRole("button", { name: /Difficulty/ }));

  it("selects the requested difficulty when its radio is activated", () => {
    const onDifficultyChange = vi.fn();
    render(
      <AI_DifficultySelector
        selectedDifficulty={AI_Difficulty.NORMAL}
        onDifficultyChange={onDifficultyChange}
      />,
    );
    openDifficultyPicker();

    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));

    expect(onDifficultyChange).toHaveBeenCalledWith(AI_Difficulty.HARD);
  });

  it("exposes the difficulty choices as one labelled radiogroup with one tab stop", () => {
    render(
      <AI_DifficultySelector
        selectedDifficulty={AI_Difficulty.NORMAL}
        onDifficultyChange={vi.fn()}
      />,
    );
    openDifficultyPicker();

    const group = screen.getByRole("radiogroup", { name: "AI difficulty" });
    const radios = screen.getAllByRole("radio");

    expect(radios).toHaveLength(3);
    expect(group.contains(radios[0])).toBe(true);
    expect(screen.getByRole("radio", { name: "Normal" }).getAttribute("aria-checked")).toBe("true");
    expect(radios.filter((radio) => radio.getAttribute("tabindex") === "0")).toEqual([
      screen.getByRole("radio", { name: "Normal" }),
    ]);
  });

  it("moves selection to the next difficulty with ArrowRight", () => {
    const onDifficultyChange = vi.fn();
    render(
      <AI_DifficultySelector
        selectedDifficulty={AI_Difficulty.NORMAL}
        onDifficultyChange={onDifficultyChange}
      />,
    );
    openDifficultyPicker();

    fireEvent.keyDown(screen.getByRole("radio", { name: "Normal" }), {
      key: "ArrowRight",
    });

    expect(onDifficultyChange).toHaveBeenCalledWith(AI_Difficulty.HARD);
  });

  it("toggles the Difficulty disclosure and its panel together", () => {
    render(
      <AI_DifficultySelector
        selectedDifficulty={AI_Difficulty.NORMAL}
        onDifficultyChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Difficulty/ });
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.classList.contains("hidden")).toBe(true);

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.classList.contains("hidden")).toBe(false);
  });
});
