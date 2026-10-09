import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickerDisclosureRootProps {
  ref?: React.Ref<HTMLDivElement>;
  open: boolean;
  onEscape: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wrapper that swallows Escape while a picker is open: the keypress collapses
 * the panel instead of reaching the sheet-level Escape-to-close listener.
 */
export function PickerDisclosureRoot({
  ref,
  open,
  onEscape,
  className,
  children,
}: PickerDisclosureRootProps) {
  return (
    <div
      ref={ref}
      className={className}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          onEscape();
        }
      }}
    >
      {children}
    </div>
  );
}

interface PickerTriggerProps {
  ref?: React.Ref<HTMLButtonElement>;
  open: boolean;
  controls: string;
  onToggle: () => void;
  label: string;
  ariaLabel?: string;
  disabled?: boolean;
  preview?: React.ReactNode;
  valueText?: string;
}

export function PickerTrigger({
  ref,
  open,
  controls,
  onToggle,
  label,
  ariaLabel,
  disabled,
  preview,
  valueText,
}: PickerTriggerProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex h-12 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        open
          ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm"
          : "border-border/70 bg-background/50 text-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60",
      )}
    >
      {preview}
      <span className="flex-1 truncate">{label}</span>
      {valueText && (
        <span className="truncate font-medium text-muted-foreground">{valueText}</span>
      )}
      <ChevronDown
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-180",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

interface PickerPanelProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

export function PickerPanel({ id, className, children }: PickerPanelProps) {
  return (
    <div
      id={id}
      className={cn(
        "col-span-2 rounded-xl border border-border/60 bg-background/50 p-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
