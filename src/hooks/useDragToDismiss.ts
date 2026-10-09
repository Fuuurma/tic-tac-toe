import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Swipe-down-to-dismiss for the bottom sheets.
 *
 * Deliberately bound to the sheet's grabber/header rather than the whole
 * panel. A sheet that owns its own content has to let that content scroll,
 * and the browser gives vertical scroll precedence over anything we can do
 * from a pointer handler: to win the gesture you need `touch-action: none`,
 * and putting that on the panel would make the pickers unscrollable. Every
 * platform bottom sheet solves it the same way — a dedicated handle with the
 * grabber as its hit area — so the drag lives there and the content scrolls
 * normally. Touch and pen only; a mouse drag on a handle reads as a mistake.
 *
 * The handle must carry `touchAction: "none"` (see DRAG_HANDLE_TOUCH_ACTION),
 * otherwise the browser starts a scroll on the first move and we never see a
 * pointermove to act on.
 */

export const DRAG_HANDLE_TOUCH_ACTION = "none";

/** Dragged this far and it counts as a dismissal, however slowly. */
const DISMISS_DISTANCE = 96;
/** A flick this fast dismisses regardless of how far it travelled. */
const DISMISS_VELOCITY = 0.5;
/** Movement needed before we commit to reading the gesture as vertical. */
const DIRECTION_LOCK = 6;
/** Never drag the sheet up past its resting position. */
const SETTLE_MS = 220;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  engaged: boolean;
  pointerIdActive: boolean;
}

interface Options {
  onDismiss: () => void;
  /** Set false to freeze the sheet in place (e.g. mid-game, where the clock
   *  runs under the overlay). */
  enabled?: boolean;
}

export function useDragToDismiss({ onDismiss, enabled = true }: Options) {
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  const drag = useRef<DragState | null>(null);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  // A sheet that unmounts mid-drag (closed by Esc or the scrim) would keep
  // the captured pointer otherwise, and the next touch would be swallowed.
  useEffect(() => {
    return () => {
      drag.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setSettling(true);
    setOffset(0);
    const t = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return t;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.pointerType === "mouse" || drag.current) return;
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        lastY: e.clientY,
        lastTime: e.timeStamp,
        velocity: 0,
        engaged: false,
        pointerIdActive: false,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;

    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;

    if (!d.engaged) {
      // Only claim the gesture once it is clearly vertical and clearly
      // downward. A short hop or a sideways swipe stays with the browser.
      if (Math.abs(dy) < DIRECTION_LOCK) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        drag.current = null;
        return;
      }
      d.engaged = true;
      d.pointerIdActive = true;
      setSettling(false);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    e.preventDefault();
    const dt = e.timeStamp - d.lastTime;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastTime = e.timeStamp;
    // Dragging up would open a gap between the sheet and the screen edge,
    // which reads as a rendering bug rather than an affordance.
    setOffset(Math.max(0, dy));
  }, []);

  const end = useCallback(
    (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.pointerId !== e.pointerId || !d.engaged) return;

      const dy = e.clientY - d.startY;
      const fling = d.velocity > DISMISS_VELOCITY && dy > DIRECTION_LOCK;
      const dragged = dy > DISMISS_DISTANCE;

      if (!cancelled && (dragged || fling)) {
        // Hand the sheet the rest of its travel so it does not snap back
        // before the close unmounts it.
        setSettling(false);
        setOffset(dy);
        dismissRef.current();
        return;
      }
      reset();
    },
    [reset],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => end(e, false),
    [end],
  );
  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => end(e, true),
    [end],
  );

  return {
    /** Put on the drag handle, alongside DRAG_HANDLE_TOUCH_ACTION. */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    /** Put on the panel that should move. */
    panelStyle: {
      transform: offset ? `translate3d(0, ${offset}px, 0)` : undefined,
      transition: settling ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : undefined,
      willChange: offset ? "transform" : undefined,
    },
    dragging: offset > 0,
  };
}