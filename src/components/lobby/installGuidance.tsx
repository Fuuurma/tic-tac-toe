import { SquareArrowOutUpRight } from "lucide-react";
import { useStrings } from "@/i18n/language";
import type { StringKey } from "@/i18n/en";

const STEPS: StringKey[] = [
  "settings.installIos.step1",
  "settings.installIos.step2",
  "settings.installIos.step3",
];

export function IosInstallGuidance() {
  const { t } = useStrings();
  return (
    <div>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 text-sm font-semibold text-foreground">
        <span>{t("settings.installIos")}</span>
        <SquareArrowOutUpRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <ol className="list-decimal space-y-1.5 py-3 pl-5 text-sm leading-relaxed text-muted-foreground">
        {STEPS.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ol>
    </div>
  );
}
