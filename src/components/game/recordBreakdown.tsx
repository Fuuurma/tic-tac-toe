import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BarChart3 } from "lucide-react";
import type { GameMode } from "@/game/constants";
import {
  breakdownRows,
  type GameStats,
  type StatsBucket,
} from "@/hooks/useGameStats";
import { cn } from "@/lib/utils";
import { placePanel } from "@/lib/panelPlacement";
import { t } from "@/i18n/language";

/**
 * Hover- or tap-to-open breakdown of the win/loss record.
 *
 * Hovering is the fast path on desktop; clicking pins it, because a touch
 * device has no hover and the panel holds the numbers the user came for.
 * It is chrome, so it stays quiet: a compact chip-sized trigger and a
 * small glass card, never a dialog competing with the board.
 *
 * The panel is placed against the viewport rather than dropped at the
 * trigger's edge: the trigger is the last thing in a phone header, so a
 * left-aligned panel ran off the right of the screen. See `placePanel`.
 */
interface RecordBreakdownProps {
  stats: GameStats;
  gameMode?: GameMode;
  /**
   * The numbers the panel explains. Rendering them inside the wrapper makes
   * the chip itself the hover target — pointing at "15 wins · 9 losses" and
   * getting nothing because only the 14px icon listens is a dead end — and
   * aligns the panel to the chip instead of to the icon at its end.
   */
  children?: React.ReactNode;
}

/**
 * Hover is a desktop gesture. On a touch screen the browser fires a synthetic
 * `mouseenter` on tap and never a matching `mouseleave`, so hover would latch
 * the panel open and the second tap — which only clears `pinned` — could not
 * close it. Ask the pointer, not the browser's emulation.
 */
const canHover = () =>
  typeof window === "undefined" ||
  typeof window.matchMedia !== "function" ||
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

export function RecordBreakdown({
  stats,
  gameMode,
  children,
}: RecordBreakdownProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rows = breakdownRows(stats.breakdown, gameMode);
  const open = (hovered || pinned) && rows.length > 0;

  // Anchor-relative offset, in px. Null until measured: the panel stays
  // invisible for that one frame instead of flashing at the wrong corner.
  // It is deliberately not reset on close — a layout effect re-measures
  // before paint, so the previous value never reaches the screen, and React
  // treats a synchronous setState in an effect body as a cascading render.
  const [offset, setOffset] = useState<{ left: number; top: number } | null>(
    null,
  );

  // Dismissal has to clear the hover too. Clicking pins the panel with the
  // pointer still resting on the trigger, so clearing only `pinned` left
  // `hovered` true and Escape looked like it did nothing. It reopens when the
  // pointer leaves and comes back, which is what "dismissed" should mean.
  const close = useCallback(() => {
    setPinned(false);
    setHovered(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const wrapper = wrapperRef.current;
      const panel = panelRef.current;
      if (!wrapper || !panel) return;
      const anchor = wrapper.getBoundingClientRect();
      const next = placePanel(
        {
          top: anchor.top,
          left: anchor.left,
          width: anchor.width,
          height: anchor.height,
        },
        { width: panel.offsetWidth, height: panel.offsetHeight },
        {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
      );
      setOffset({ left: next.left - anchor.left, top: next.top - anchor.top });
    };

    place();
    // The trigger moves under the panel whenever the page scrolls or the
    // window resizes; a placement computed once is stale the moment either
    // happens. Capture catches scrolls of any ancestor, not just the window.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

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
      className="relative inline-flex items-center gap-0.5"
      onMouseEnter={() => {
        if (canHover()) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onBlurCapture={onBlurCapture}
    >
      {children}
      <button
        type="button"
        aria-label={t("game.breakdown")}
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
          ref={panelRef}
          role="group"
          aria-label={t("game.breakdownGroup")}
          className={cn(
            "glass absolute z-30 w-max min-w-52 max-w-[min(17rem,calc(100vw-1rem))] rounded-xl p-3 text-left shadow-lg",
            // A tall breakdown on a short window is clamped to the screen by
            // `placePanel`; the cap keeps the card readable instead of letting
            // it run past the bottom edge.
            "max-h-[calc(100dvh-1rem)] overflow-y-auto",
            offset ? "visible" : "invisible",
          )}
          style={{
            // `glass` is tuned for large surfaces over the gradient (0.35
            // tint). This panel is small, dense, and lands on top of the
            // player cards, so it borrows the same material with an opaque
            // enough base to read numbers against. At 0.82 the winner's name
            // and the opponent's mark read through it, doubling the text
            // behind the numbers; 0.95 still left the name faintly sharp (the
            // blur does not soften it here), so only the tint hides it.
            "--glass-alpha": "0.98",
            left: `${offset?.left ?? 0}px`,
            top: `${offset?.top ?? 0}px`,
          } as React.CSSProperties}
        >
          <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-black/10 pb-1.5 dark:border-white/10">
            <span className="text-xs font-semibold text-foreground">
              {t("game.breakdownTitle")}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("game.gamesTotal", { count: stats.totalGames })}
            </span>
          </div>
          <dl className="flex flex-col gap-1.5">
            {rows.map((row) => (
              <div
                key={row.key}
                // 12px is the readability floor in DESIGN.md, and these are
                // numbers someone is reading, not chrome: 11px was under it.
                className="flex items-baseline justify-between gap-4 text-xs"
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
    return <span className="text-muted-foreground/70">{t("game.noGames")}</span>;
  }
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {t("game.tallyWins", { count: bucket.wins })}
      </span>
      <span className="mx-1 text-muted-foreground/50">·</span>
      <span className="font-semibold text-red-500">
        {t("game.tallyLosses", { count: bucket.losses })}
      </span>
    </span>
  );
}
