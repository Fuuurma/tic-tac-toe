import { useEffect, useRef } from "react";

/**
 * Collapse an open picker panel when a press lands outside it.
 * Escape stays local to the component (PickerDisclosureRoot swallows it so
 * the sheet-level Escape-to-close listener never sees an open dropdown's
 * dismissal).
 *
 * Dismissal rides `click`, not `pointerdown`, and that is load-bearing — the
 * reflow-vs-tap story is recorded in
 * docs/adr/0002-outside-press-dismissal-rides-click.md.
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
