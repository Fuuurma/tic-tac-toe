import { useEffect, useRef } from "react";

/**
 * Collapse an open picker panel when a press lands outside it.
 * Escape stays local to the component (PickerDisclosureRoot swallows it so
 * the sheet-level Escape-to-close listener never sees an open dropdown's
 * dismissal).
 *
 * Dismissal rides `click`, not `pointerdown`, and that is load-bearing. These
 * panels expand inside a bottom sheet, so closing one reflows the sheet and
 * slides everything above it — on a phone the sheet grows upward from the
 * bottom edge, which moves the sheet's own close button. Collapsing on
 * pointerdown moved that button ~35px before the pointer came back up, so the
 * press and the release landed on different elements and the tap was silently
 * swallowed: tap the ✕ with a picker open and nothing happens, tap again and
 * it closes. One `click` puts the dismissal and whatever the press targeted in
 * the same batch, so the reflow can only land after the tap has resolved.
 *
 * A scroll does not dismiss: a drag produces no click, and click is the only
 * listener.
 */
export function useDismissOnOutsidePress(
  rootRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
) {
  const onOutsideRef = useRef(onOutside);
  // Latest-ref assignment belongs in the commit phase, not render.
  useEffect(() => {
    onOutsideRef.current = onOutside;
  });
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOutsideRef.current();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [rootRef, active]);
}
