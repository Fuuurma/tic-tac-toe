import { Moon, Sun } from "lucide-react";
import { useAppTheme } from "@/hooks/useAppTheme";

export function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  const ThemeIcon = nextTheme === "dark" ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className="glass-interactive flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
    >
      <ThemeIcon className="size-4.5" aria-hidden="true" />
    </button>
  );
}
