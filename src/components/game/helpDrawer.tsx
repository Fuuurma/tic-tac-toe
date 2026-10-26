import { Clock, Grid3x3, Keyboard, MoveRight, RotateCcw, Trophy } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
  /** Offered where leaving the screen costs nothing (the lobby), never mid-game. */
  onReplayTutorial?: () => void;
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
    body: "On a keyboard, press 1-9 to place your mark on the matching cell. The layout reads left to right, top to bottom: 1 is top-left, 9 is bottom-right.",
  },
  {
    Icon: Clock,
    title: "Turn timer",
    body: "You have 10 seconds per turn. Run out and a random legal move is played for you. Stay sharp.",
  },
];

export function HelpDrawer({ isOpen, onClose, inline = false, onReplayTutorial }: HelpDrawerProps) {
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      inline={inline}
      title="How to play"
      closeLabel="Close help"
      bodyClassName="sm:pb-5"
    >
      <ul className="flex flex-col gap-5 pt-1">
        {TIPS.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="glass-cell flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      {onReplayTutorial && (
        <button
          type="button"
          onClick={onReplayTutorial}
          className="glass-interactive flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Replay the practice round
        </button>
      )}
    </Sheet>
  );
}
