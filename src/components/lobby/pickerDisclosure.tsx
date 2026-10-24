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
  presentation?: "standard" | "tile";
  className?: string;
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
  presentation = "standard",
  className,
}: PickerTriggerProps) {
  const isTile = presentation === "tile";

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
        isTile
          ? "relative flex h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-xl border p-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          : "flex h-12 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-xs font-semibold max-sm:text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        isTile
          ? open
            ? "border-primary ring-2 ring-primary/35"
            : "border-border/70 bg-background/50 hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60"
          : open
            ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm"
            : "border-border/70 bg-background/50 text-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60",
        className,
      )}
    >
      {isTile ? (
        <>
          <span className="sr-only">{label}</span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            {preview}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full border border-border/50 bg-background/90 text-muted-foreground"
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
            />
          </span>
        </>
      ) : (
        <>
          {preview}
          <span className="flex-1 truncate">{label}</span>
          {valueText && (
            <span className="truncate font-medium text-muted-foreground">
              {valueText}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </>
      )}
    </button>
  );
}

interface PickerPanelProps {
  id: string;
  /** Keep the panel visible on phones even when its desktop disclosure is closed. */
  alwaysOpenOnMobile?: boolean;
  open: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PickerPanel({
  id,
  open,
  alwaysOpenOnMobile = false,
  className,
  children,
}: PickerPanelProps) {
  return (
    <div
      id={id}
      className={cn(
        "col-span-2 rounded-xl border border-border/60 bg-background/50 p-2",
        alwaysOpenOnMobile &&
          "max-sm:flex max-sm:flex-col max-sm:gap-2 max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:p-0",
        !open && "hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
