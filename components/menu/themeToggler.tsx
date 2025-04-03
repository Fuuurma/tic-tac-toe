"use client";
import { useTheme } from "next-themes";
import { User, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeTogglerButton = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </Button>
  );
};

export default ThemeTogglerButton;
