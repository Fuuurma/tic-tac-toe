// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { useDragToDismiss } from "./useDragToDismiss"

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
function Harness({
  open,
  onClose,
  dragEnabled = true,
}: {
  open: boolean;
  onClose: () => void;
  dragEnabled?: boolean;
}) {
  const drag = useDragToDismiss({ onDismiss: onClose, enabled: open && dragEnabled });
  return (
    <div>
      <div data-testid="handle" {...(dragEnabled ? drag.handleProps : {})} />
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

function finishSubthresholdDrag(handle: HTMLElement) {
  fireEvent.pointerDown(handle, {
    pointerId: 1,
    clientX: 0,
    clientY: 10,
    pointerType: "touch",
    timeStamp: 0,
  });
  fireEvent.pointerMove(handle, {
    pointerId: 1,
    clientX: 0,
    clientY: 60,
    pointerType: "touch",
    timeStamp: 200,
  });
  fireEvent.pointerUp(handle, {
    pointerId: 1,
    clientX: 0,
    clientY: 60,
    pointerType: "touch",
    timeStamp: 220,
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

describe("useDragToDismiss settling (F652)", () => {
  it("keeps the latest snap-back transition through a rapid re-grab", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { getByTestId } = render(<Harness open onClose={onClose} />);
    const handle = getByTestId("handle");
    const panel = getByTestId("panel");

    finishSubthresholdDrag(handle);
    expect(panel.style.transition).toContain("transform 220ms");
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(80);
    });
    finishSubthresholdDrag(handle);
    expect(panel.style.transition).toContain("transform 220ms");

    // The first drag's 220 ms timeout must not end the second drag's settle.
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(panel.style.transition).toContain("transform 220ms");

    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(panel.style.transition).toBe("");
  });

  it("clears a pending snap-back timer when the sheet unmounts", () => {
    vi.useFakeTimers();
    const { getByTestId, unmount } = render(
      <Harness open onClose={vi.fn()} />,
    );

    finishSubthresholdDrag(getByTestId("handle"));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useDragToDismiss disabled gesture (F666)", () => {
  it("drops a captured drag when disabled before it is reenabled", () => {
    const onClose = vi.fn();
    const { getByTestId, rerender } = render(
      <Harness open onClose={onClose} />,
    );
    const handle = getByTestId("handle");
    const panel = getByTestId("panel");

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
    expect(panel.style.transform).toContain("50px");

    // The handle handlers are removed while the drag is disabled, then
    // restored when the game stops; a captured old gesture must not resume.
    rerender(<Harness open dragEnabled={false} onClose={onClose} />);
    expect(panel.style.transform).toBe("");
    rerender(<Harness open onClose={onClose} />);
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 0,
      clientY: 160,
      pointerType: "touch",
    });
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 0,
      clientY: 160,
      pointerType: "touch",
    });

    expect(panel.style.transform).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  });
});
