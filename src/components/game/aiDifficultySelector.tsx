import { AI_Difficulty, type AI_Difficulty as AI_DifficultyType } from "@/game/constants";
import { cn } from "@/lib/utils";

interface AI_DifficultySelectorProps {
  selectedDifficulty: AI_DifficultyType;
  onDifficultyChange: (difficulty: AI_DifficultyType) => void;
}

const DIFFICULTIES: { value: AI_DifficultyType; label: string; hint: string }[] = [
  { value: AI_Difficulty.EASY, label: "Easy", hint: "Random" },
  { value: AI_Difficulty.NORMAL, label: "Normal", hint: "Heuristic" },
  { value: AI_Difficulty.HARD, label: "Hard", hint: "Minimax" },
  { value: AI_Difficulty.INSANE, label: "Insane", hint: "MCTS" },
];

export function AI_DifficultySelector({
  selectedDifficulty,
  onDifficultyChange,
}: AI_DifficultySelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="AI difficulty"
      className="grid grid-cols-4 gap-1 rounded-lg border bg-muted/40 p-1"
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
            onClick={() => onDifficultyChange(value)}
            className={cn(
              "flex flex-col items-center gap-0 rounded-md px-1 py-1.5 text-[10px] font-semibold transition sm:text-xs",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{label}</span>
            <span className="text-[8px] font-normal opacity-60 sm:text-[10px]">
              {hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
