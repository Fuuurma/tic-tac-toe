import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRAG_HANDLE_TOUCH_ACTION, useDragToDismiss } from "@/hooks/useDragToDismiss";

/**
 * The one overlay surface: settings, help, confirms.
 *
 * Phone (below `sm`): a form owns the screen. `size="full"` is a full-height
 * page that slides up from the bottom edge; `size="auto"` is a content-height
 * action sheet pinned to the bottom, for short decisions like a confirm. Both
 * keep their primary action in a footer inside thumb reach, and both dismiss
 * with a swipe down on the header bar.
 *
 * Desktop (`sm` and up): a centered dialog capped at 85dvh, as before.
 *
 * Built on native <dialog>. The modal path uses showModal(), so Esc, the
 * focus trap, the top layer and focus restore all come from the platform.
 * `inline` renders it non-modal inside the nearest positioned ancestor on
 * desktop (the online surface keeps its board visible beside the rules); on
 * a phone an inline sheet still covers the screen, because there is no
 * "beside" at 375px.
 */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Accessible name of the header close button. */
  closeLabel?: string;
  children: ReactNode;
  /** Sticky action row under the scrolling body. */
  footer?: ReactNode;
  /** Extra header content between the title and the close button. */
  headerExtra?: ReactNode;
  size?: "full" | "auto";
  inline?: boolean;
  /** Freeze swipe-to-dismiss (Esc and the close button still work). */
  dragDisabled?: boolean;
  /** Visually hide the close button (a confirm answers with its footer). */
  hideClose?: boolean;
  style?: CSSProperties;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  closeLabel = "Close",
  children,
  footer,
  headerExtra,
  size = "full",
  inline = false,
  dragDisabled = false,
  hideClose = false,
  style,
  className,
  bodyClassName,
  footerClassName,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `${useId()}-title`;
  const onCloseRef = useRef(onClose);
  const drag = useDragToDismiss({ onDismiss: onClose, enabled: open && !dragDisabled });
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg || inline) return;
    if (open && !dlg.open) {
      dlg.showModal();
      // The panel, not the first field: focusing an input on open pops the
      // phone keyboard over a sheet the player has not read yet.
      dlg.focus();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open, inline]);

  // Non-modal (inline) dialogs get no Esc, focus trap or focus restore from
  // the platform, so the inline path supplies them.
  useEffect(() => {
    if (!open || !inline) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      const dlg = dialogRef.current;
      if (e.key !== "Tab" || !dlg) return;
      const focusable = dlg.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      previousFocusRef.current = null;
    };
  }, [open, inline]);

  const full = size === "full";

  const panelClass = cn(
    // A closed <dialog> hides via the UA's `dialog:not([open])` rule, which
    // any author `display` beats — so display follows `open` (F588).
    open ? "flex" : "hidden",
    "glass sheet-surface flex-col overflow-hidden p-0 text-foreground shadow-2xl outline-none",
    // Phone geometry.
    "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:m-0 max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-up",
    full
      ? "max-sm:top-0 max-sm:h-dvh max-sm:max-h-none max-sm:rounded-none max-sm:border-0"
      : "max-sm:top-auto max-sm:max-h-[92dvh] max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0",
    // Desktop geometry. Preflight's margin:0 kills the UA's `margin:auto`,
    // so centering is explicit.
    inline
      ? "sm:static sm:m-0 sm:max-h-full sm:w-full sm:rounded-2xl"
      : "sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:w-full sm:max-w-md sm:rounded-2xl",
    "sm:animate-pop-in",
    className,
  );

  const panel = (
    <>
      <div
        className={cn(
          "flex shrink-0 select-none flex-col px-5 pb-3",
          full ? "pt-[max(0.5rem,var(--inset-top))] sm:pt-5" : "pt-2 sm:pt-5",
        )}
        style={{ touchAction: dragDisabled ? undefined : DRAG_HANDLE_TOUCH_ACTION }}
        {...(dragDisabled ? {} : drag.handleProps)}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden"
        />
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-bold tracking-tight">
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            {!hideClose && (
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="glass-interactive flex size-11 items-center justify-center rounded-lg text-muted-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-5",
          !footer && "pb-[max(1.25rem,var(--inset-bottom))]",
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer && (
        <div
          className={cn(
            "sheet-footer flex shrink-0 flex-col gap-2 px-5 pt-3 pb-[max(1rem,var(--inset-bottom))] sm:pb-5",
            footerClassName,
          )}
        >
          {footer}
        </div>
      )}
    </>
  );

  if (inline) {
    if (!open) return null;
    return (
      <div
        ref={scrimRef}
        className="fixed inset-0 z-50 flex justify-center bg-overlay-scrim sm:absolute"
        onClick={(e) => {
          if (e.target === scrimRef.current) onClose();
        }}
      >
        <dialog
          ref={dialogRef}
          open
          tabIndex={-1}
          aria-labelledby={titleId}
          className={panelClass}
          style={{ ...style, ...drag.panelStyle }}
        >
          {panel}
        </dialog>
      </div>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCloseRef.current();
      }}
      onClick={(e) => {
        // A modal dialog's backdrop click targets the dialog element itself.
        if (e.target === dialogRef.current) onClose();
      }}
      className={cn(panelClass, "backdrop:bg-overlay-scrim")}
      style={{ ...style, ...drag.panelStyle }}
    >
      {panel}
    </dialog>
  );
}
