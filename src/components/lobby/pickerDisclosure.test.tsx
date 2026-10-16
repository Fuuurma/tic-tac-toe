// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PickerDisclosureRoot, PickerPanel, PickerTrigger } from "./pickerDisclosure";

describe("PickerDisclosureRoot", () => {
  afterEach(cleanup);

  it("dismisses an open picker on Escape without bubbling to its parent", () => {
    const onEscape = vi.fn();
    const onParentKeyDown = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <PickerDisclosureRoot open onEscape={onEscape}>
          <button type="button">Picker option</button>
        </PickerDisclosureRoot>
      </div>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Picker option" }), {
      key: "Escape",
    });

    expect(onEscape).toHaveBeenCalledOnce();
    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it("lets Escape bubble when the picker is closed", () => {
    const onEscape = vi.fn();
    const onParentKeyDown = vi.fn();
    render(
      <div onKeyDown={onParentKeyDown}>
        <PickerDisclosureRoot open={false} onEscape={onEscape}>
          <button type="button">Outside picker</button>
        </PickerDisclosureRoot>
      </div>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Outside picker" }), {
      key: "Escape",
    });

    expect(onEscape).not.toHaveBeenCalled();
    expect(onParentKeyDown).toHaveBeenCalledOnce();
  });

  it("exposes the trigger state and calls its toggle handler", () => {
    const onToggle = vi.fn();
    render(
      <PickerTrigger
        open={false}
        controls="color-panel"
        onToggle={onToggle}
        label="Color"
        ariaLabel="Your color"
        valueText="Blue"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Your color" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe("color-panel");
    fireEvent.click(trigger);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows or hides its panel as the open state changes", () => {
    const { rerender } = render(
      <PickerPanel id="color-panel" open={false}>
        <p>Color choices</p>
      </PickerPanel>,
    );
    const panel = screen.getByText("Color choices").parentElement;

    expect(panel?.classList.contains("hidden")).toBe(true);
    rerender(
      <PickerPanel id="color-panel" open>
        <p>Color choices</p>
      </PickerPanel>,
    );
    expect(panel?.classList.contains("hidden")).toBe(false);
  });
});
