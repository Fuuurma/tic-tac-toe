import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "@/hooks/useAppTheme";
import { t, useStrings } from "@/i18n/language";
import type { StringKey } from "@/i18n/en";
import { cn } from "@/lib/utils";
import type { AppTheme } from "@/lib/preferences";

/**
 * Light | Dark segmented control.
 *
 * This was an icon button that flipped the theme on every tap, so the current
 * theme was only inferable from which glyph you were looking at, and the
 * opposite meaning of the same button read differently depending on the theme
 * you were already in. A two-option control states where you are (`aria-pressed`
 * on the active option) and never hides one of the two choices.
 *
 * The footprint follows `LanguageSwitcher` on purpose: two app-level
 * preferences should be the same control shape, not two ideas about the same
 * job. No "system" option — `useAppTheme` stores `light | dark`, and a
 * follow-the-OS mode is a separate feature with a media-query listener.
 */
export function ThemeSegmented({ className }: { className?: string }) {
  const { theme, setTheme } = useAppTheme();
  // Subscribes so a language switch re-renders the labels.
  useStrings();
  const options: { value: AppTheme; labelKey: StringKey; Icon: typeof Sun }[] = [
    { value: "light", labelKey: "theme.light", Icon: Sun },
    { value: "dark", labelKey: "theme.dark", Icon: Moon },
  ];
  return (
    <div
      role="group"
      aria-label={t("settings.appearance")}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/50 p-1 text-sm",
        className,
      )}
    >
      {options.map(({ value, labelKey, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 font-bold transition max-sm:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-[rgb(var(--player-color)/0.15)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.35)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
