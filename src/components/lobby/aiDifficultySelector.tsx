import { AI_Difficulty, type AI_Difficulty as AI_DifficultyType } from "@/game/constants";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface AI_DifficultySelectorProps {
  selectedDifficulty: AI_DifficultyType;
  onDifficultyChange: (difficulty: AI_DifficultyType) => void;
}

const DIFFICULTIES: { value: AI_DifficultyType; label: string; hint: string }[] = [
  { value: AI_Difficulty.EASY, label: "Easy", hint: "Relaxed" },
  { value: AI_Difficulty.NORMAL, label: "Normal", hint: "Smart" },
  { value: AI_Difficulty.HARD, label: "Hard", hint: "Expert" },
];

export function AI_DifficultySelector({
  selectedDifficulty,
  onDifficultyChange,
}: AI_DifficultySelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="radiogroup"
        aria-label="AI difficulty"
        className="grid grid-cols-3 gap-2"
      >
        {DIFFICULTIES.map(({ value, label, hint }) => {
          const active = selectedDifficulty === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-label={label}
              aria-checked={active}
              data-state={active ? "active" : "inactive"}
              onClick={() => onDifficultyChange(value)}
              className={cn(
                "flex min-h-12 flex-col items-stretch justify-center gap-1 rounded-lg border px-2 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                active
                  ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold">{label}</span>
                {active && <Check className="size-3.5 text-[rgb(var(--player-color))]" aria-hidden="true" />}
              </span>
              <span className="text-[11px] font-normal leading-tight text-muted-foreground">
                {hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
