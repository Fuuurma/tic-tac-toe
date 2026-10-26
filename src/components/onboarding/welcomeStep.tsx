import { Play } from "lucide-react";
import { Color } from "@/game/constants";
import { Button } from "@/components/ui/button";
import { GameMark } from "@/components/lobby/gameMark";
import { ctaStyle } from "./ctaStyle";
import { StepShell } from "./stepShell";

const WHAT_HAPPENS_NEXT = [
  "Set up your player",
  "Play a quick practice round",
  "Jump into a real game",
];

export function WelcomeStep({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      hero
      color={Color.BLUE}
      title="Welcome"
      contentClassName="items-center justify-center gap-6 text-center"
      footer={
        <>
          <Button
            type="button"
            size="lg"
            variant="glass"
            onClick={onStart}
            className="h-12 w-full text-base font-bold sm:h-14"
            style={ctaStyle(Color.BLUE)}
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            Get started
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="h-11 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Skip, I know how to play
          </button>
        </>
      }
    >
      <GameMark />
      <div className="flex flex-col gap-2.5">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight">
          Your oldest mark vanishes.
        </h1>
        <p className="text-pretty text-base leading-relaxed text-muted-foreground">
          Each player keeps three marks on the board. Place a fourth and your oldest one
          disappears. Line up three to win.
        </p>
      </div>
      <ol className="glass-cell flex w-full flex-col gap-3 rounded-xl px-4 py-3.5 text-left">
        {WHAT_HAPPENS_NEXT.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground/10 text-xs font-bold text-muted-foreground"
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
    </StepShell>
  );
}
