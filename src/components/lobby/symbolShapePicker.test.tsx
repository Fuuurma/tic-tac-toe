// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SymbolShapePicker } from "./symbolShapePicker";
import { AVAILABLE_SHAPES, SHAPE_LABELS, SymbolShape } from "@/game/constants";

// The tiles used to be glyph-only: `label` was computed and handed to
// aria-label, so screen-reader users heard "Triangle"/"Diamond" while sighted
// users got eight unlabelled shapes. The sibling colorPicker in the same form
// already renders a visible truncated name next to its swatch, so this is an
// internal-consistency gap, not a deliberate icon-only house style.
describe("SymbolShapePicker tiles", () => {
  afterEach(cleanup);

  const renderPicker = (label = "Your shape") =>
    render(
      <SymbolShapePicker
        label={label}
        value={SymbolShape.STAR}
        onChange={vi.fn()}
      />,
    );

  it("names its legend and radiogroup from the caller's label", () => {
    renderPicker("Opponent shape");

    expect(screen.getByRole("radiogroup", { name: "Opponent shape" })).toBeTruthy();
    expect(screen.getByText("Opponent shape")).toBeTruthy();
  });

  it("shows every shape name as visible text, not only as an accessible name", () => {
    renderPicker();

    // textContent is the visible text; getByRole(name:) would also be
    // satisfied by aria-label alone, which is exactly what the bug had.
    for (const shape of AVAILABLE_SHAPES) {
      const tile = screen.getByRole("radio", { name: SHAPE_LABELS[shape] });
      expect(tile.textContent?.trim()).toBe(SHAPE_LABELS[shape]);
    }
  });

  it("labels every tile with its own name", () => {
    const { container } = renderPicker();
    const tiles = container.querySelectorAll('[role="radio"]');

    expect(tiles).toHaveLength(AVAILABLE_SHAPES.length);
    const visible = Array.from(tiles).map((t) => t.textContent?.trim());
    expect(new Set(visible).size).toBe(AVAILABLE_SHAPES.length);
  });

  it("exposes the same name as a title tooltip, matching colorPicker", () => {
    const { container } = renderPicker();
    const tiles = Array.from(container.querySelectorAll('[role="radio"]'));

    for (const tile of tiles) {
      const label = tile.getAttribute("aria-label");
      expect(label).toBeTruthy();
      expect(tile.getAttribute("title")).toBe(label);
    }
  });

  it("keeps the selected tile marked for assistive tech", () => {
    renderPicker();
    const selected = screen.getByRole("radio", {
      name: SHAPE_LABELS[SymbolShape.STAR],
    });

    expect(selected.getAttribute("aria-checked")).toBe("true");
    expect(selected.getAttribute("data-state")).toBe("active");
  });
});
