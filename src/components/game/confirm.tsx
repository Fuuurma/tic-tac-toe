import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // Native <dialog> + showModal(): Esc fires `cancel`, focus is trapped
  // in the top layer, and focus returns to the invoker on close — the
  // hand-rolled keydown handler and focus-save refs existed only to
  // re-create this behavior. The dialog stays mounted so `open` is the
  // single source of truth; isOpen just syncs it.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (isOpen && !dlg.open) {
      dlg.showModal();
      cancelRef.current?.focus();
    } else if (!isOpen && dlg.open) {
      dlg.close();
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={() => onCancelRef.current()}
      className={cn(
        "inset-0 m-auto w-[calc(100%-2rem)] max-w-sm bg-transparent p-0 backdrop:bg-overlay-scrim",
        isOpen && "animate-pop-in",
      )}
    >
      <div
        className="glass rounded-2xl px-5 py-6 sm:px-6 sm:py-7"
        style={
          {
            "--glass-alpha": "0.96",
            "--player-color": destructive ? "239 68 68" : playerColor,
          } as React.CSSProperties
        }
      >
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="glass" size="sm" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            size="sm"
            variant="glass"
            onClick={onConfirm}
            className="font-bold"
            style={
              {
                "--glass-sweep-color": destructive ? "239 68 68" : playerColor,
                "--glass-tint": destructive ? "239 68 68" : playerColor,
                "--glass-alpha": "0.15",
                "--glass-sheen": destructive ? "239 68 68" : playerColor,
                "--glass-sheen-alpha": "0.25",
              } as React.CSSProperties
            }
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
