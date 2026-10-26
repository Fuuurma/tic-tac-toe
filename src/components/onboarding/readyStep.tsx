import { Clock, Keyboard, Play, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStrings } from "@/i18n/language";
import { PlayerSummaryCard } from "@/components/lobby/playerSettingsSheet";
import type { Profile } from "./profileStep";
import { ctaStyle } from "./ctaStyle";
import { StepShell } from "./stepShell";

const FACTS: { Icon: typeof Clock; titleKey: "ob.ready.fact1.title" | "ob.ready.fact2.title" | "ob.ready.fact3.title" | "ob.ready.fact4.title"; bodyKey: "ob.ready.fact1.body" | "ob.ready.fact2.body" | "ob.ready.fact3.body" | "ob.ready.fact4.body" }[] = [
  { Icon: Clock, titleKey: "ob.ready.fact1.title", bodyKey: "ob.ready.fact1.body" },
  { Icon: Keyboard, titleKey: "ob.ready.fact2.title", bodyKey: "ob.ready.fact2.body" },
  { Icon: Users, titleKey: "ob.ready.fact3.title", bodyKey: "ob.ready.fact3.body" },
  { Icon: RotateCcw, titleKey: "ob.ready.fact4.title", bodyKey: "ob.ready.fact4.body" },
];

export function ReadyStep({ profile, onStart }: { profile: Profile; onStart: () => void }) {
  const { t } = useStrings();
  return (
    <StepShell
      color={profile.color}
      title={t("ob.ready.title", { name: profile.displayName })}
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
          {t("ob.ready.start")}
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
        {FACTS.map(({ Icon, titleKey, bodyKey }) => (
          <li key={titleKey} className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="glass-cell flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">{t(titleKey)}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
            </div>
          </li>
        ))}
      </ul>
    </StepShell>
  );
}
