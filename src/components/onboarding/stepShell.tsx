import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { COLOR_RGB, type Color } from "@/game/constants";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StepShellProps {
  color: Color;
  /** Accessible name of the step. Rendered as the heading unless `hero`. */
  title: string;
  /** The step draws its own heading; no header row. */
  hero?: boolean;
  progress?: { current: number; total: number };
  onSkip?: () => void;
  /** Move focus to the heading on arrival so the new step is announced. */
  focusTitle?: boolean;
  footer: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * One onboarding screen, built like the lobby so the handoff between them is
 * invisible: a glass card on desktop, the whole screen on a phone, content
 * that scrolls, and the primary action pinned in thumb reach.
 */
export function StepShell({
  color,
  title,
  hero = false,
  progress,
  onSkip,
  focusTitle = false,
  footer,
  contentClassName,
  children,
}: StepShellProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusTitle) titleRef.current?.focus();
  }, [focusTitle]);

  return (
    <div
      className="flex max-h-full w-full max-w-md flex-col max-sm:h-full max-sm:max-w-none sm:my-auto"
      style={{ "--player-color": COLOR_RGB[color] } as CSSProperties}
    >
      <Card
        variant="glass"
        className="animate-step-in flex min-h-0 flex-1 flex-col gap-0 overflow-clip py-0 max-sm:rounded-none max-sm:border-0 max-sm:shadow-none"
      >
        {!hero && (
          <header className="flex shrink-0 flex-col gap-3 px-4 pb-3 pt-[max(1rem,var(--inset-top))] sm:px-6 sm:pt-6">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <h1
                ref={titleRef}
                tabIndex={-1}
                className="min-w-0 text-xl font-bold tracking-tight outline-none"
              >
                {title}
              </h1>
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="glass-interactive flex h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold text-muted-foreground"
                >
                  Skip
                </button>
              )}
            </div>
            {progress && (
              <>
                <p className="sr-only">
                  Step {progress.current} of {progress.total}
                </p>
                <div aria-hidden="true" className="flex gap-1.5">
                  {Array.from({ length: progress.total }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-sm transition-colors duration-300",
                        i < progress.current
                          ? "bg-[rgb(var(--player-color))]"
                          : "bg-foreground/15",
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </header>
        )}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6",
            hero && "pt-[max(1rem,var(--inset-top))] sm:pt-8",
            contentClassName,
          )}
        >
          {children}
        </div>
        <footer className="flex shrink-0 flex-col gap-2 px-4 pb-[max(1rem,var(--inset-bottom))] pt-2 sm:px-6 sm:pb-6 sm:pt-1">
          {footer}
        </footer>
      </Card>
    </div>
  );
}
