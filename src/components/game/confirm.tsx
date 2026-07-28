import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  playerColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({
  isOpen,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  playerColor = "255 255 255",
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasPreviousFocusRef = useRef(false);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  useEffect(() => {
    if (!isOpen) {
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      previousFocusRef.current = null;
      hasPreviousFocusRef.current = false;
      return;
    }
    if (!hasPreviousFocusRef.current) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      hasPreviousFocusRef.current = true;
    }
    cancelRef.current?.focus();
    const dialog = containerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
    >
      <div
        className="glass animate-pop-in flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border-b-0 p-5 shadow-2xl sm:rounded-2xl sm:border-b"
        style={{
          "--glass-alpha": "0.92",
          "--player-color": destructive ? "239 68 68" : playerColor,
        } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden" />
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <span className="size-8 shrink-0 sm:hidden" />
        </div>
        <div className="mt-2 overflow-y-auto">
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
          <div className="mt-4 flex justify-end gap-2">
          <Button ref={cancelRef} variant="glass" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            size="sm"
            variant="glass"
            onClick={onConfirm}
            className="font-bold"
            style={{
              "--glass-sweep-color": destructive ? "239 68 68" : playerColor,
              "--glass-tint": destructive ? "239 68 68" : playerColor,
              "--glass-alpha": "0.15",
              "--glass-sheen": destructive ? "239 68 68" : playerColor,
              "--glass-sheen-alpha": "0.25",
            } as React.CSSProperties}
          >
            {confirmText}
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
