import { useId, useRef, useState } from "react";
import {
  AI_Difficulty,
  AI_DIFFICULTY_LABELS,
  type AI_Difficulty as AI_DifficultyType,
} from "@/game/constants";
import { handleRadioGroupKeyDown } from "@/lib/radioGroup";
import { cn } from "@/lib/utils";
import { Bot, Check } from "lucide-react";
import {
  PickerDisclosureRoot,
  PickerPanel,
  PickerTrigger,
} from "./pickerDisclosure";
import { useDismissOnOutsidePress } from "@/hooks/useDismissOnOutsidePress";

interface AI_DifficultySelectorProps {
  selectedDifficulty: AI_DifficultyType;
  onDifficultyChange: (difficulty: AI_DifficultyType) => void;
}

const DIFFICULTIES: AI_DifficultyType[] = Object.values(AI_Difficulty);

export function AI_DifficultySelector({
  selectedDifficulty,
  onDifficultyChange,
}: AI_DifficultySelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useDismissOnOutsidePress(rootRef, open, () => setOpen(false));

  return (
    <PickerDisclosureRoot
      ref={rootRef}
      open={open}
      onEscape={() => {
        setOpen(false);
        triggerRef.current?.focus();
      }}
      className="flex flex-col gap-2"
    >
      <PickerTrigger
        ref={triggerRef}
        open={open}
        controls={panelId}
        onToggle={() => setOpen((current) => !current)}
        label="Difficulty"
        preview={
          <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        }
        valueText={AI_DIFFICULTY_LABELS[selectedDifficulty]}
      />
      {open && (
        <PickerPanel id={panelId}>
          <div
            role="radiogroup"
            aria-label="AI difficulty"
            className="grid grid-cols-3 gap-2"
            onKeyDown={handleRadioGroupKeyDown}
          >
            {DIFFICULTIES.map((value) => {
              const label = AI_DIFFICULTY_LABELS[value];
              const active = selectedDifficulty === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-label={label}
                  aria-checked={active}
                  data-state={active ? "active" : "inactive"}
                  tabIndex={active ? 0 : -1}
                  onClick={() => onDifficultyChange(value)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    active
                      ? "border-[rgb(var(--player-color))] bg-[rgb(var(--player-color)/0.1)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.2)]"
                      : "border-border/70 bg-background/50 text-muted-foreground hover:border-[rgb(var(--player-color)/0.4)] hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span>{label}</span>
                  {active && <Check className="size-3.5 text-[rgb(var(--player-color))]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </PickerPanel>
      )}
    </PickerDisclosureRoot>
  );
}
