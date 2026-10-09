import { useEffect, useRef } from "react";

/**
 * Collapse an open picker panel when a pointer press lands outside it.
 * Escape stays local to the component (PickerDisclosureRoot swallows it so
 * the sheet-level Escape-to-close listener never sees an open dropdown's
 * dismissal).
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
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onOutsideRef.current();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [rootRef, active]);
}
