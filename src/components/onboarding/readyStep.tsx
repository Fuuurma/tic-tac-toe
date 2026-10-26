import { Clock, Keyboard, Play, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerSummaryCard } from "@/components/lobby/playerSettingsSheet";
import type { Profile } from "./profileStep";
import { ctaStyle } from "./ctaStyle";
import { StepShell } from "./stepShell";

const FACTS: { Icon: typeof Clock; title: string; body: string }[] = [
  {
    Icon: Clock,
    title: "10 seconds per turn",
    body: "Run out and a random move is played for you.",
  },
  {
    Icon: Keyboard,
    title: "Keys 1 to 9",
    body: "On a keyboard, 1 is the top left square and 9 is the bottom right.",
  },
  {
    Icon: Users,
    title: "Three ways to play",
    body: "Face the AI, a friend on this device, or someone online.",
  },
  {
    Icon: RotateCcw,
    title: "Practice any time",
    body: "Replay the practice round from How to play.",
  },
];

export function ReadyStep({ profile, onStart }: { profile: Profile; onStart: () => void }) {
  return (
    <StepShell
      color={profile.color}
      title={`You're all set, ${profile.displayName}`}
      progress={{ current: 3, total: 3 }}
      focusTitle
      contentClassName="gap-5"
      footer={
        <Button
          type="button"
          size="lg"
          variant="glass"
          onClick={onStart}
          className="h-12 w-full text-base font-bold sm:h-14"
          style={ctaStyle(profile.color)}
        >
          <Play className="h-5 w-5" aria-hidden="true" />
          Start playing
        </Button>
      }
    >
      <PlayerSummaryCard
        settings={{
          displayName: profile.displayName,
          color: profile.color,
          playerShape: profile.shape,
        }}
      />
      <ul className="flex flex-col gap-4">
        {FACTS.map(({ Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="glass-cell flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </StepShell>
  );
}
