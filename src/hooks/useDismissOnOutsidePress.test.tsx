// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDismissOnOutsidePress } from "./useDismissOnOutsidePress";

afterEach(() => {
  cleanup();
});

/**
 * A root with one child inside it and a sibling outside it — the two
 * positions the dismissal listener has to tell apart.
 */
function Harness({
  active,
  onOutside,
}: {
  active: boolean;
  onOutside: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOnOutsidePress(rootRef, active, onOutside);
  return (
    <div>
      <div data-testid="root" ref={rootRef}>
        <button data-testid="inside" type="button">
          inside
        </button>
      </div>
      <button data-testid="outside" type="button">
        outside
      </button>
    </div>
  );
}

describe("useDismissOnOutsidePress — dismissal rides click, not pointerdown", () => {
  it("does not dismiss on an outside pointerdown alone", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Harness active onOutside={onOutside} />);

    // A press emits pointerdown before click. Dismissing on pointerdown
    // reflows the bottom sheet mid-tap and swallows the following release —
    // the exact bug the hook's docstring says the click listener avoids.
    fireEvent.pointerDown(getByTestId("outside"));

    expect(onOutside).not.toHaveBeenCalled();
  });

  it("dismisses on an outside click", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Harness active onOutside={onOutside} />);

    fireEvent.click(getByTestId("outside"));

    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss for a press and click inside the root", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Harness active onOutside={onOutside} />);
    const inside = getByTestId("inside");

    fireEvent.pointerDown(inside);
    fireEvent.pointerUp(inside);
    fireEvent.click(inside);

    expect(onOutside).not.toHaveBeenCalled();
  });

  it("ignores outside clicks while inactive", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(
      <Harness active={false} onOutside={onOutside} />,
    );

    fireEvent.click(getByTestId("outside"));

    expect(onOutside).not.toHaveBeenCalled();
  });
});
