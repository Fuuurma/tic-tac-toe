import { Languages } from "lucide-react";
import { t, useStrings } from "@/i18n/language";
import type { StringKey } from "@/i18n/en";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/preferences";

/**
 * One-button language toggle: globe + the current language code, tap to
 * flip. Lives beside the theme toggle in the player form. The welcome step
 * keeps the segmented control below, where a first-run visitor picks from
 * both options explicitly.
 */
export function LanguageToggle() {
  const { locale, setLocale } = useStrings();
  const next: Locale = locale === "en" ? "es" : "en";
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t("lang.toggle")}
      title={t("lang.toggle")}
      className="glass-interactive flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold text-muted-foreground"
    >
      <Languages className="size-4.5" aria-hidden="true" />
      {locale.toUpperCase()}
    </button>
  );
}

/**
 * EN | ES segmented control. Labels stay in their own language either way
 * ("English" / "Español"), so the control is usable before you can read
 * anything else. Serves the welcome step; `size` only changes its footprint.
 */
export function LanguageSwitcher({ size = "md" }: { size?: "sm" | "md" }) {
  const { locale, setLocale } = useStrings();
  const options: { value: Locale; labelKey: StringKey }[] = [
    { value: "en", labelKey: "lang.english" },
    { value: "es", labelKey: "lang.spanish" },
  ];
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/50 p-1",
        size === "sm" ? "text-xs" : "text-sm",
      )}
    >
      {options.map(({ value, labelKey }) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(value)}
            className={cn(
              "rounded-md font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              size === "sm" ? "px-2.5 py-1.5" : "px-3.5 py-2",
              active
                ? "bg-[rgb(var(--player-color)/0.15)] text-foreground shadow-sm ring-1 ring-[rgb(var(--player-color)/0.35)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
