import { useId, useState } from "react";
import { Dices, User } from "lucide-react";
import {
  COLOR_BG_CLASSES,
  COLOR_MARK_TEXT,
  type Color,
  type SymbolShape,
} from "@/game/constants";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/lobby/colorPicker";
import { SymbolShapePicker } from "@/components/lobby/symbolShapePicker";
import { SymbolShapeRenderer } from "@/components/game/symbolShapeRenderer";
import { filterDisplayNameInput, generateGuestDisplayName, sanitizeDisplayName } from "@/lib/identity";
import { useStrings } from "@/i18n/language";
import { cn } from "@/lib/utils";
import { ctaStyle } from "./ctaStyle";
import { StepShell } from "./stepShell";

export interface Profile {
  displayName: string;
  color: Color;
  shape: SymbolShape;
}

export function ProfileStep({
  initial,
  onConfirm,
  onSkip,
}: {
  initial: Profile;
  onConfirm: (profile: Profile) => void;
  onSkip: () => void;
}) {
  const nameId = useId();
  const hintId = useId();
  const { t } = useStrings();
  const [name, setName] = useState(initial.displayName);
  const [color, setColor] = useState(initial.color);
  const [shape, setShape] = useState(initial.shape);

  const cleanName = sanitizeDisplayName(name, "");
  const valid = cleanName !== "";

  return (
    <StepShell
      color={color}
      title={t("ob.profile.title")}
      progress={{ current: 1, total: 3 }}
      onSkip={onSkip}
      focusTitle
      contentClassName="gap-5"
      footer={
        <Button
          type="button"
          size="lg"
          variant="glass"
          disabled={!valid}
          onClick={() => onConfirm({ displayName: cleanName, color, shape })}
          className={cn(
            "h-12 w-full text-base font-bold sm:h-14",
            !valid && "cursor-not-allowed opacity-50",
          )}
          style={ctaStyle(color)}
        >
          {t("ob.profile.continue")}
        </Button>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("ob.profile.body")}
      </p>

      <div className="flex items-end gap-3">
        {/* Remounts on every pick so the new look pops in: the preview is the
            feedback loop, not a static badge. */}
        <span
          key={`${color}-${shape}`}
          aria-hidden="true"
          className={cn(
            "animate-pop-in grid size-16 shrink-0 place-items-center rounded-2xl shadow-lg",
            COLOR_BG_CLASSES[color],
            COLOR_MARK_TEXT[color],
          )}
        >
          <SymbolShapeRenderer shape={shape} strokeWidth={8} className="size-9" />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-semibold text-muted-foreground">
            {t("ob.profile.name")}
          </label>
          <div className="relative">
            <User
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(e) => setName(filterDisplayNameInput(e.target.value))}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={valid ? undefined : true}
              aria-describedby={valid ? undefined : hintId}
              className={cn(
                "h-12 w-full rounded-lg border border-input bg-background/60 pl-9 pr-12 text-field outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary",
                !valid && "border-destructive focus-visible:ring-destructive",
              )}
            />
            <button
              type="button"
              aria-label={t("ob.profile.suggestName")}
              title={t("ob.profile.suggestName")}
              onClick={() => setName(generateGuestDisplayName())}
              className="glass-interactive absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground"
            >
              <Dices className="size-4.5" aria-hidden="true" />
            </button>
          </div>
          {!valid && (
            <p id={hintId} role="alert" className="mt-1.5 text-sm leading-tight text-destructive">
              {t("ob.profile.nameHint")}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby={`${nameId}-color`} className="flex flex-col gap-2">
        <h2 id={`${nameId}-color`} className="text-sm font-semibold text-muted-foreground">
          {t("ob.profile.color")}
        </h2>
        <ColorPicker label={t("ob.profile.yourColor")} value={color} onChange={setColor} />
      </section>

      <section aria-labelledby={`${nameId}-symbol`} className="flex flex-col gap-2">
        <h2 id={`${nameId}-symbol`} className="text-sm font-semibold text-muted-foreground">
          {t("ob.profile.symbol")}
        </h2>
        <SymbolShapePicker label={t("ob.profile.yourSymbol")} value={shape} onChange={setShape} />
      </section>
    </StepShell>
  );
}
