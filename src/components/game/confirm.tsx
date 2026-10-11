import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

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
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Sheet focuses its panel on open. Focus Cancel instead so Enter on a
  // destructive prompt never confirms by accident. This runs after Sheet's
  // own effect, which has already opened the dialog.
  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  return (
    <Sheet
      open={isOpen}
      onClose={onCancel}
      title={title}
      size="auto"
      hideClose
      className="sm:max-w-sm"
      style={
        {
          "--glass-alpha": "0.96",
          "--player-color": destructive ? "239 68 68" : playerColor,
        } as React.CSSProperties
      }
      // Primary action first on a phone stack (thumb reach), Cancel first
      // in the desktop row, matching the native dialog this replaced.
      footerClassName="flex-col-reverse sm:flex-row sm:justify-end"
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="glass"
            size="sm"
            onClick={onCancel}
            className="max-sm:min-h-12 max-sm:w-full"
          >
            {cancelText}
          </Button>
          <Button
            size="sm"
            variant="glass"
            onClick={onConfirm}
            className="font-bold max-sm:min-h-12 max-sm:w-full"
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
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{description}</p>
    </Sheet>
  );
}
