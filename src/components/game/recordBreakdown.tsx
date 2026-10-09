import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { GameMode } from "@/game/constants";
import {
  breakdownRows,
  type GameStats,
  type StatsBucket,
} from "@/hooks/useGameStats";
import { cn } from "@/lib/utils";

/**
 * Hover- or tap-to-open breakdown of the win/loss record.
 *
 * Hovering is the fast path on desktop; clicking pins it, because a touch
 * device has no hover and the panel holds the numbers the user came for.
 * It is chrome, so it stays quiet: a compact chip-sized trigger and a
 * small glass card, never a dialog competing with the board.
 */
interface RecordBreakdownProps {
  stats: GameStats;
  gameMode?: GameMode;
}

export function RecordBreakdown({ stats, gameMode }: RecordBreakdownProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rows = breakdownRows(stats.breakdown, gameMode);
  const open = (hovered || pinned) && rows.length > 0;

  const close = useCallback(() => setPinned(false), []);

  useEffect(() => {
    if (!pinned) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pinned, close]);

  // Unpin when focus leaves, so a panel opened by keyboard is never left
  // stranded over the board.
  const onBlurCapture = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
      setPinned(false);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onBlurCapture={onBlurCapture}
    >
      <button
        type="button"
        aria-label="Show record breakdown"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setPinned((value) => !value)}
        className={cn(
          // The 24px visual sits inline in an 11px stat run, so growing the
          // box itself would break the header rhythm. A pseudo-element
          // expands the hit area to the 44px touch minimum without moving
          // anything; the icon stays where it was.
          "relative inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-colors",
          "after:absolute after:-inset-2.5 after:content-['']",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          open && "text-foreground",
        )}
      >
        <BarChart3 className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Record by mode and difficulty"
          className="glass absolute left-0 top-[calc(100%+0.375rem)] z-30 w-max min-w-44 max-w-[min(14rem,calc(100vw-2rem))] rounded-xl p-2.5 text-left shadow-lg"
          // `glass` is tuned for large surfaces over the gradient (0.35
          // tint). This panel is small, dense, and lands on top of the
          // player cards, so it borrows the same material with an opaque
          // enough base to read numbers against.
          style={{ "--glass-alpha": "0.82" } as React.CSSProperties}
        >
          <dl className="flex flex-col gap-1">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-baseline justify-between gap-4 text-[11px]"
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd>
                  <BucketTally bucket={row.bucket} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function BucketTally({ bucket }: { bucket: StatsBucket }) {
  const played = bucket.wins + bucket.losses;
  if (played === 0) {
    return <span className="text-muted-foreground/70">No games</span>;
  }
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {bucket.wins}W
      </span>
      <span className="mx-1 text-muted-foreground/50">·</span>
      <span className="font-semibold text-red-500">{bucket.losses}L</span>
    </span>
  );
}