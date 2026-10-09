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
    body: "Each player can only have 3 marks on the board at once. Place a 4th and your oldest mark vanishes, so plan your moves.",
  },
  {
    Icon: MoveRight,
    title: "Oldest mark moves first",
    body: "When you place your 4th mark, the oldest one is automatically removed. Watch the wiggling border. That is the mark that goes next.",
  },
  {
    Icon: Trophy,
    title: "Win condition",
    body: "Get 3 of your marks in a row, column, or diagonal. Winning cells light up emerald green.",
  },
  {
    Icon: Keyboard,
    title: "Keyboard shortcuts",
    body: "Press 1-9 to place your mark on the matching cell. The layout reads left to right, top to bottom: 1 is top-left, 9 is bottom-right.",
  },
  {
    Icon: Clock,
    title: "Turn timer",
    body: "You have 10 seconds per turn. Run out and a random legal move is played for you. Stay sharp.",
  },
];

export function HelpDrawer({ isOpen, onClose, inline = false }: HelpDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Native <dialog> both ways. Non-inline uses showModal(): Esc fires
  // `cancel`, focus is trapped in the top layer, and focus returns to the
  // invoker on close — all for free. Inline keeps the panel-scoped overlay
  // (a modal top-layer dialog would cover the whole viewport instead of
  // the panel, hiding the board the rules describe), so it renders the
  // dialog non-modal via the `open` attribute and keeps the hand-rolled
  // Esc/Tab handling — non-modal dialogs get neither from the platform.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (isOpen && !inline && !dlg.open) {
      dlg.showModal();
      closeRef.current?.focus();
    } else if (!isOpen && dlg.open) {
      dlg.close();
    }
  }, [isOpen, inline]);

  useEffect(() => {
    if (!isOpen || !inline) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
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
    return () => {
      window.removeEventListener("keydown", onKey);
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen, inline]);

  const panel = (
    <>
      <div className="flex shrink-0 flex-col gap-2 pb-2">
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-foreground/20 sm:hidden" />
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-bold tracking-tight">
            How to play
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="glass-interactive flex size-11 items-center justify-center rounded-lg text-muted-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
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
    </>
  );

  // Both dialogs need explicit centering/anchoring: Tailwind preflight's
  // margin:0 kills the UA's `margin: auto`, and display:flex overrides
  // the UA's `dialog[open]{display:block}` for the flex-col layout.
  const panelClass = cn(
    // `display` has to follow isOpen rather than being set once. A closed
    // <dialog> is hidden by the UA rule `dialog:not([open]) { display:none }`,
    // but any author-level `display` beats the UA stylesheet — so a static
    // `flex` here left the closed "How to play" panel permanently rendered
    // in the lobby, 272px of live dialog sitting under the Start button.
    // The dialog stays mounted (the effect below needs the node to call
    // showModal()/close()); it is only hidden.
    isOpen ? "flex" : "hidden",
    "glass w-full flex-col overflow-hidden p-5 shadow-2xl",
    inline
      ? // static in-flow child of the scrim flex — panel-scoped, full size
        "static m-0 max-h-full rounded-2xl"
      : // absolute+inset-0+margin auto centers; mb-0 anchors the mobile
        // bottom-sheet edge, sm:mb-auto recenters on desktop.
        // The bottom pad clears the home indicator: with viewport-fit=cover
        // the sheet spans the full viewport, and a plain p-5 would leave its
        // last row under the indicator on a notched iPhone.
        "inset-0 m-auto mb-0 max-h-[85dvh] max-w-md rounded-t-2xl pb-[max(1.25rem,var(--inset-bottom))] sm:mb-auto sm:rounded-2xl",
    isOpen && "animate-pop-in",
  );

  if (inline) {
    // Panel-scoped overlay: the scrim div positions the non-modal dialog
    // inside the parent's relative box. isOpen gates the render so `open`
    // never lingers on a closed drawer.
    if (!isOpen) return null;
    return (
      <div
        ref={scrimRef}
        className="absolute inset-0 z-50 flex justify-center bg-overlay-scrim p-0"
        onClick={(e) => {
          if (e.target === scrimRef.current) onClose();
        }}
      >
        <dialog
          ref={dialogRef}
          open
          aria-labelledby={titleId}
          className={panelClass}
        >
          {panel}
        </dialog>
      </div>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={() => onCloseRef.current()}
      onClick={(e) => {
        // Backdrop click: for a modal dialog, a click outside the panel
        // box targets the dialog element itself.
        if (e.target === dialogRef.current) onClose();
      }}
      className={cn(panelClass, "backdrop:bg-overlay-scrim")}
    >
      {panel}
    </dialog>
  );
}
