import type { ReactNode } from "react";
import { ChevronRight, Settings2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { LanguageSwitcher } from "./languageSwitcher";
import { ThemeSegmented } from "./themeToggle";
import { t, useStrings } from "@/i18n/language";

/**
 * App preferences: the settings that are not about who is playing.
 *
 * Theme, language and the two learning entries used to be scattered — the
 * theme toggle in the lobby masthead AND the player form, language in the
 * player form AND the onboarding welcome, help as four separate entry points,
 * the tutorial buried at the bottom of the rules sheet. They now live here, and
 * here is the only place they live.
 *
 * Deliberately NOT the same surface as the You/Opponent form. That form is a
 * setup task with its own tabs; folding these rows into it as a third tab made
 * one dialog answer two unrelated questions ("who plays" and "how does the app
 * behave"), and made the guest case awkward. Separate sheets, one entry point
 * each: the gear opens this, the player cards open that.
 */
export function PreferencesSheet({
  isOpen,
  onClose,
  onHowToPlay,
  onReplayTutorial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onHowToPlay: () => void;
  onReplayTutorial?: () => void;
}) {
  // Subscribes so a language switch re-renders the labels.
  useStrings();

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t("settings.title")}
      // Short list: content-height on phones, so the game stays visible behind.
      size="auto"
      compactMobile
      // Four fixed rows: a swipe anywhere on the sheet moves it.
      dragFromBody
    >
      {isOpen && (
        <div className="flex flex-col">
          <Row label={t("settings.appearance")}>
            <ThemeSegmented className={SEGMENTED_WIDTH} />
          </Row>
          <Row label={t("settings.language")}>
            <LanguageSwitcher className={SEGMENTED_WIDTH} />
          </Row>
          <Group label={t("settings.learn")}>
            <LinkRow label={t("settings.howToPlay")} onClick={onHowToPlay} />
            {onReplayTutorial && (
              <LinkRow label={t("help.replay")} onClick={onReplayTutorial} />
            )}
          </Group>
        </div>
      )}
    </Sheet>
  );
}

/**
 * The two-option controls share one width, so their right edges line up and
 * the pair reads as a set instead of two shrink-wrapped pills of different
 * length. Wide enough for "Español" and "Oscuro" with the glyph, narrow
 * enough that the label still fits beside it at 320px.
 */
const SEGMENTED_WIDTH = "grid w-[11.5rem] shrink-0 grid-cols-2";

/**
 * One setting, one row: the name on the left, its control on the right,
 * hairline under it. The label used to sit above a control that hugged the
 * left edge, which left the right half of the sheet empty and made each
 * setting two stacked things instead of one line. It wraps rather than clips
 * if a translation ever outgrows the row.
 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-col">
      <h3 className="m-0 mb-1 text-xs font-semibold text-muted-foreground">{label}</h3>
      {children}
    </div>
  );
}

/** A row whose whole width is the action. */
function LinkRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-border/60 text-left text-sm font-semibold text-foreground transition-colors last:border-b-0 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
    >
      {label}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/** The control the gear renders. Kept here so the icon and the sheet agree. */
export const SettingsIcon = Settings2;
