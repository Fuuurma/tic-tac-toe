// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useDragToDismiss } from "./useDragToDismiss"

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  // jsdom does not implement pointer capture; the engaged branch calls it.
  if (typeof Element !== "undefined" && !Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
});

/**
 * F632: the modal sheet stays MOUNTED when closed, so an offset parked
 * by a swipe-dismiss survived the reopen and the sheet reappeared
 * translated. The pin drives a real 150px swipe through the handle and
 * asserts the parked travel is gone after close + reopen.
 */
function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drag = useDragToDismiss({ onDismiss: onClose, enabled: open });
  return (
    <div>
      <div data-testid="handle" {...drag.handleProps} />
      <div data-testid="panel" style={drag.panelStyle} />
    </div>
  );
}

function swipeDown(handle: HTMLElement, toY: number) {
  fireEvent.pointerDown(handle, {
    pointerId: 1,
    clientX: 0,
    clientY: 10,
    pointerType: "touch",
  });
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: 0,
    clientY: 60,
    pointerType: "touch",
  });
  fireEvent.pointerUp(handle, {
    pointerId: 1,
    clientX: 0,
    clientY: toY,
    pointerType: "touch",
  });
}

describe("useDragToDismiss sheet reopen (F632)", () => {
  it("drops a swipe-dismiss offset when the sheet closes and reopens", () => {
    const onClose = vi.fn();
    const { getByTestId, rerender } = render(
      <Harness open onClose={onClose} />,
    );
    swipeDown(getByTestId("handle"), 160);
    expect(onClose).toHaveBeenCalledTimes(1);
    // The dismiss branch parks the travel so the close animation can
    // finish; the parked value is visible in the panel transform.
    expect(getByTestId("panel").style.transform).toContain("150px");

    // Close (the modal path stays mounted) and reopen on the same mount.
    rerender(<Harness open={false} onClose={onClose} />);
    rerender(<Harness open onClose={onClose} />);
    expect(getByTestId("panel").style.transform).toBe("");
  });

  it("still fires onClose exactly once per swipe", () => {
    const onClose = vi.fn();
    const { getByTestId, rerender } = render(
      <Harness open onClose={onClose} />,
    );
    swipeDown(getByTestId("handle"), 160);
    rerender(<Harness open={false} onClose={onClose} />);
    rerender(<Harness open onClose={onClose} />);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
