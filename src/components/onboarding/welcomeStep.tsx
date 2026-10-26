import { Play } from "lucide-react";
import { Color } from "@/game/constants";
import { Button } from "@/components/ui/button";
import { GameMark } from "@/components/lobby/gameMark";
import { LanguageSwitcher } from "@/components/lobby/languageSwitcher";
import { useStrings } from "@/i18n/language";
import { ctaStyle } from "./ctaStyle";
import { StepShell } from "./stepShell";

const WHAT_HAPPENS_NEXT_KEYS = [
  "ob.welcome.item1",
  "ob.welcome.item2",
  "ob.welcome.item3",
] as const;

export function WelcomeStep({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const { t } = useStrings();
  return (
    <StepShell
      hero
      color={Color.BLUE}
      title={t("ob.welcome.title")}
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
            {t("ob.welcome.start")}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="h-11 rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("ob.welcome.skip")}
          </button>
        </>
      }
    >
      <GameMark />
      {/* First-run visitors choose their language before reading a word. */}
      <LanguageSwitcher size="sm" />
      <div className="flex flex-col gap-2.5">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight">
          {t("ob.welcome.headline")}
        </h1>
        <p className="text-pretty text-base leading-relaxed text-muted-foreground">
          {t("ob.welcome.body")}
        </p>
      </div>
      <ol className="glass-cell flex w-full flex-col gap-3 rounded-xl px-4 py-3.5 text-left">
        {WHAT_HAPPENS_NEXT_KEYS.map((key, i) => (
          <li key={key} className="flex items-center gap-3 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground/10 text-xs font-bold text-muted-foreground"
            >
              {i + 1}
            </span>
            {t(key)}
          </li>
        ))}
      </ol>
    </StepShell>
  );
}
