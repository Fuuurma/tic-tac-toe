import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "@/hooks/useAppTheme";
import { t, useStrings } from "@/i18n/language";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useAppTheme();
  // Subscribes so the tooltip follows a language switch.
  useStrings();
  const nextTheme = theme === "light" ? "dark" : "light";
  const ThemeIcon = nextTheme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={nextTheme === "dark" ? t("theme.toDark") : t("theme.toLight")}
      title={nextTheme === "dark" ? t("theme.toDark") : t("theme.toLight")}
      className={cn(
        "glass-interactive flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground",
        className,
      )}
    >
      <ThemeIcon className="size-4.5" aria-hidden="true" />
    </button>
  );
}
