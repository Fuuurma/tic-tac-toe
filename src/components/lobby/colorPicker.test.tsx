// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ColorPicker } from "./colorPicker";
import { AVAILABLE_COLORS, Color } from "@/game/constants";

/**
 * F516: the swatch grid rendered eight aria-pressed toggles — every one in
 * the Tab order, arrow/Home/End keys inert — while every sibling
 * single-select in the app follows the ARIA radiogroup contract
 * (role="radiogroup" + role="radio" + aria-checked + roving tabIndex +
 * the shared handleRadioGroupKeyDown). These tests pin the contract.
 */
describe("ColorPicker radiogroup contract (F516)", () => {
  afterEach(cleanup);

  const renderPicker = (onChange = vi.fn(), value: Color = Color.BLUE) =>
    render(
      <ColorPicker
        label="Your color"
        value={value}
        onChange={onChange}
      />,
    );

  it("exposes the swatches as radios inside a labelled radiogroup", () => {
    renderPicker();
    const group = screen.getByRole("radiogroup", { name: "Your color" });
    const radios = screen.getAllByRole("radio");

    expect(group.contains(radios[0])).toBe(true);
    expect(radios).toHaveLength(AVAILABLE_COLORS.length);
  });

  it("marks the selected swatch with aria-checked, not aria-pressed", () => {
    renderPicker();
    const selected = screen.getByRole("radio", { name: "Blue" });

    expect(selected.getAttribute("aria-checked")).toBe("true");
    expect(selected.getAttribute("aria-pressed")).toBeNull();
  });

  it("keeps the group a single tab stop — only the selected swatch is tabbable", () => {
    renderPicker();
    const tabbable = screen
      .getAllByRole("radio")
      .filter((el) => el.getAttribute("tabindex") === "0");

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-checked")).toBe("true");
  });

  it("arrow keys move focus and selection to the next swatch", () => {
    const onChange = vi.fn();
    renderPicker(onChange);
    const blue = screen.getByRole("radio", { name: "Blue" });
    const nextColor = AVAILABLE_COLORS[AVAILABLE_COLORS.indexOf(Color.BLUE) + 1];

    fireEvent.keyDown(blue, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith(nextColor);
  });

  it("Home selects the first swatch from anywhere in the group", () => {
    const onChange = vi.fn();
    renderPicker(onChange, Color.RED);
    const red = screen.getByRole("radio", { name: "Red" });

    fireEvent.keyDown(red, { key: "Home" });

    expect(onChange).toHaveBeenCalledWith(AVAILABLE_COLORS[0]);
  });
});
