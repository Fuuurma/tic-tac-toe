// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Confirm } from "./confirm";

// jsdom does not implement the native <dialog> modal methods that Sheet calls.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

describe("Confirm", () => {
  afterEach(cleanup);

  const renderConfirm = (overrides: Partial<Parameters<typeof Confirm>[0]> = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <Confirm
        isOpen
        title="Start a new game"
        description="Restart with the same players and settings?"
        confirmText="Restart"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...overrides}
      />,
    );
    return { onConfirm, onCancel };
  };

  it("shows the title, description and both actions", () => {
    renderConfirm();

    expect(screen.getByRole("heading", { name: "Start a new game" })).toBeTruthy();
    expect(screen.getByText("Restart with the same players and settings?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restart" })).toBeTruthy();
  });

  it("calls onConfirm and onCancel from their buttons", () => {
    const { onConfirm, onCancel } = renderConfirm();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("focuses Cancel on open so Enter on a destructive prompt cannot confirm", () => {
    renderConfirm({ destructive: true, confirmText: "Exit", title: "Exit game" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });
});
