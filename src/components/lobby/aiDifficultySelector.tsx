import { useId, useRef, useState } from "react";
import {
  AI_Difficulty,
  type AI_Difficulty as AI_DifficultyType,
} from "@/game/constants";
import { getDifficultyLabel, t, useStrings } from "@/i18n/language";
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

/**
 * Desktop keeps the "Difficulty" dropdown. Phones drop the dropdown for an
 * always-visible three-segment control: fewer taps, and every level is visible.
 */
export function AI_DifficultySelector({
  selectedDifficulty,
  onDifficultyChange,
}: AI_DifficultySelectorProps) {
  // Subscribes so a language switch re-renders the segments.
  useStrings();
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
      <p className="text-sm font-semibold sm:hidden">{t("settings.difficulty")}</p>
      <PickerTrigger
        ref={triggerRef}
        open={open}
        controls={panelId}
        onToggle={() => setOpen((current) => !current)}
        label={t("settings.difficulty")}
        className="max-sm:hidden"
        preview={
          <Bot className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        }
        valueText={getDifficultyLabel(selectedDifficulty)}
      />
      <PickerPanel id={panelId} open={open} alwaysOpenOnMobile>
        <div
          role="radiogroup"
          aria-label={t("settings.aiDifficulty")}
          className="grid grid-cols-3 gap-2"
          onKeyDown={handleRadioGroupKeyDown}
        >
          {DIFFICULTIES.map((value) => {
            const label = getDifficultyLabel(value);
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
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-semibold transition max-sm:h-12 max-sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
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
    </PickerDisclosureRoot>
  );
}
