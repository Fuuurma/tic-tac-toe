// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SymbolShapePicker } from "./symbolShapePicker";
import { AVAILABLE_SHAPES, SHAPE_LABELS, SymbolShape } from "@/game/constants";

// Tiles are icon-only by owner direction: the glyph is self-describing, so the
// name lives on aria-label (assistive tech) and title (hover tooltip) instead
// of as visible text under every tile. The radiogroup contract (role, roving
// tabIndex, aria-checked, arrow keys) is unchanged — only the captions went.
describe("SymbolShapePicker tiles", () => {
  afterEach(cleanup);

  const renderPicker = (label = "Your symbol") =>
    render(
      <SymbolShapePicker
        label={label}
        value={SymbolShape.STAR}
        onChange={vi.fn()}
      />,
    );

  it("names its radiogroup from the caller's label", () => {
    renderPicker("Opponent symbol");

    expect(screen.getByRole("radiogroup", { name: "Opponent symbol" })).toBeTruthy();
  });

  it("renders every tile icon-only, with no visible text", () => {
    const { container } = renderPicker();
    const tiles = container.querySelectorAll('[role="radio"]');

    expect(tiles).toHaveLength(AVAILABLE_SHAPES.length);
    for (const tile of tiles) {
      expect(tile.textContent?.trim()).toBe("");
    }
  });

  it("labels every tile with its own accessible name", () => {
    renderPicker();

    for (const shape of AVAILABLE_SHAPES) {
      // getByRole throws if the name is missing or not unique.
      expect(screen.getByRole("radio", { name: SHAPE_LABELS[shape] })).toBeTruthy();
    }
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
