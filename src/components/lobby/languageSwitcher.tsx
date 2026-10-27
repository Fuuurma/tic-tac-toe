import { t, useStrings } from "@/i18n/language";
import type { StringKey } from "@/i18n/en";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/preferences";

/**
 * EN | ES segmented control. Labels stay in their own language either way
 * ("English" / "Español"), so the control is usable before you can read
 * anything else. Serves the welcome step; `size` only changes its footprint.
 */
export function LanguageSwitcher({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
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
        className,
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
              size === "sm" ? "px-2.5 py-1.5" : "px-3.5 py-2 max-sm:min-h-11",
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
