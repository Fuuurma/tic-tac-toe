import { Clock, Grid3x3, Keyboard, MoveRight, RotateCcw, Trophy } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useStrings } from "@/i18n/language";

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
  /** Offered where leaving the screen costs nothing (the lobby), never mid-game. */
  onReplayTutorial?: () => void;
}

const TIPS: { Icon: typeof Clock; titleKey: `help.tip${1 | 2 | 3 | 4 | 5}.title`; bodyKey: `help.tip${1 | 2 | 3 | 4 | 5}.body` }[] = [
  { Icon: Grid3x3, titleKey: "help.tip1.title", bodyKey: "help.tip1.body" },
  { Icon: MoveRight, titleKey: "help.tip2.title", bodyKey: "help.tip2.body" },
  { Icon: Trophy, titleKey: "help.tip3.title", bodyKey: "help.tip3.body" },
  { Icon: Keyboard, titleKey: "help.tip4.title", bodyKey: "help.tip4.body" },
  { Icon: Clock, titleKey: "help.tip5.title", bodyKey: "help.tip5.body" },
];

export function HelpDrawer({ isOpen, onClose, inline = false, onReplayTutorial }: HelpDrawerProps) {
  const { t } = useStrings();
  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      inline={inline}
      size="auto"
      compactMobile
      title={t("help.title")}
      closeLabel={t("help.close")}
      bodyClassName="sm:pb-5"
      // Phone: a 75%-height bottom sheet, never full-screen, so the game
      // stays visible behind the rules. tailwind-merge keeps this cap over
      // the auto size's own max-h.
      className="max-sm:max-h-[75dvh]"
      footer={
        onReplayTutorial ? (
          <button
            type="button"
            onClick={onReplayTutorial}
            className="glass-interactive flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("help.replay")}
          </button>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-5 pt-1">
        {TIPS.map(({ Icon, titleKey, bodyKey }) => (
          <li key={titleKey} className="flex gap-3.5">
            <span
              aria-hidden="true"
              className="glass-cell flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground"
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground">{t(titleKey)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(bodyKey)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
