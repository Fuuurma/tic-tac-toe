// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppearancePickers } from "./appearancePickers";
import { Color, SymbolShape } from "@/game/constants";

describe("AppearancePickers", () => {
  afterEach(cleanup);

  it("sends a selected color to the color callback", () => {
    const onColorChange = vi.fn();
    const onShapeChange = vi.fn();
    render(
      <AppearancePickers
        colorLabel="Your color"
        shapeLabel="Your symbol"
        color={Color.BLUE}
        shape={SymbolShape.STAR}
        onColorChange={onColorChange}
        onShapeChange={onShapeChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Your color" }));

    fireEvent.click(screen.getByRole("radio", { name: "Green" }));

    expect(onColorChange).toHaveBeenCalledWith(Color.GREEN);
    expect(onShapeChange).not.toHaveBeenCalled();
  });

  it("sends a selected symbol to the symbol callback", () => {
    const onColorChange = vi.fn();
    const onShapeChange = vi.fn();
    render(
      <AppearancePickers
        colorLabel="Your color"
        shapeLabel="Your symbol"
        color={Color.BLUE}
        shape={SymbolShape.STAR}
        onColorChange={onColorChange}
        onShapeChange={onShapeChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Your symbol" }));

    fireEvent.click(screen.getByRole("radio", { name: "Heart" }));

    expect(onShapeChange).toHaveBeenCalledWith(SymbolShape.HEART);
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it("keeps only the most recently opened appearance panel visible", () => {
    render(
      <AppearancePickers
        colorLabel="Your color"
        shapeLabel="Your symbol"
        color={Color.BLUE}
        shape={SymbolShape.STAR}
        onColorChange={vi.fn()}
        onShapeChange={vi.fn()}
      />,
    );
    const colorTrigger = screen.getByRole("button", { name: "Your color" });
    const shapeTrigger = screen.getByRole("button", { name: "Your symbol" });
    const colorPanel = document.getElementById(colorTrigger.getAttribute("aria-controls")!);
    const shapePanel = document.getElementById(shapeTrigger.getAttribute("aria-controls")!);

    fireEvent.click(colorTrigger);
    expect(colorTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(colorPanel?.classList.contains("hidden")).toBe(false);

    fireEvent.click(shapeTrigger);
    expect(colorTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(shapeTrigger.getAttribute("aria-expanded")).toBe("true");
    expect(colorPanel?.classList.contains("hidden")).toBe(true);
    expect(shapePanel?.classList.contains("hidden")).toBe(false);
  });

  it("disables symbol selection when an online room assigns the symbol", () => {
    render(
      <AppearancePickers
        colorLabel="Your color"
        shapeLabel="Your symbol"
        color={Color.BLUE}
        shape={SymbolShape.STAR}
        shapeDisabled
        onColorChange={vi.fn()}
        onShapeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Your symbol" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("radio", { name: "Heart" })).toBeNull();
    expect(screen.getByText("Online rooms assign your symbol when you connect.")).toBeTruthy();
  });

  it("closes the active picker on Escape and returns focus to its trigger", () => {
    render(
      <AppearancePickers
        colorLabel="Your color"
        shapeLabel="Your symbol"
        color={Color.BLUE}
        shape={SymbolShape.STAR}
        onColorChange={vi.fn()}
        onShapeChange={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Your color" });
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!);
    fireEvent.click(trigger);
    const blue = screen.getByRole("radio", { name: "Blue" });
    blue.focus();

    fireEvent.keyDown(blue, { key: "Escape" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.classList.contains("hidden")).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});
