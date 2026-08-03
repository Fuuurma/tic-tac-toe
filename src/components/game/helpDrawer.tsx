import { useEffect, useId, useRef } from "react";
import { Clock, Grid3x3, Keyboard, MoveRight, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

const TIPS: { Icon: typeof Clock; title: string; body: string }[] = [
  {
    Icon: Grid3x3,
    title: "Three-piece limit",
    body: "Each player can only have 3 marks on the board at once. Place a 4th and your oldest mark vanishes — so plan your moves.",
  },
  {
    Icon: MoveRight,
    title: "Oldest mark moves first",
    body: "When you place your 4th mark, the oldest one is automatically removed. Watch the wiggling border — that's the mark that goes next.",
  },
  {
    Icon: Trophy,
    title: "Win condition",
    body: "Get 3 of your marks in a row, column, or diagonal. Winning cells light up emerald green.",
  },
  {
    Icon: Keyboard,
    title: "Keyboard shortcuts",
    body: "Press 1–9 to place your mark on the matching cell. The layout reads left-to-right, top-to-bottom: 1 is top-left, 9 is bottom-right.",
  },
  {
    Icon: Clock,
    title: "Turn timer",
    body: "You have 10 seconds per turn. Run out and a random legal move is played for you. Stay sharp.",
  },
];

export function HelpDrawer({ isOpen, onClose, inline = false }: HelpDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const hasPreviousFocusRef = useRef(false);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;

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
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn(
        "z-50 flex justify-center bg-black/50",
        inline
          ? "absolute inset-0 items-stretch p-0"
          : "fixed inset-0 items-end p-0 sm:items-center",
      )}
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          "glass animate-pop-in flex max-h-[85dvh] w-full flex-col p-5 shadow-2xl",
          inline
            ? "rounded-2xl"
            : "max-w-md rounded-t-2xl border-b-0 sm:rounded-2xl sm:border-b",
        )}
        style={{ "--glass-alpha": "0.92" } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
          <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden" />
          <h2 id={titleId} className="text-lg font-bold tracking-tight">
            How to play
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="glass-interactive flex size-8 items-center justify-center rounded-full text-muted-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <ul className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto py-2">
          {TIPS.map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="glass-cell flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
