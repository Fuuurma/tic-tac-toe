import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { User, Moon, Sun } from "lucide-react"; // Icons

const colors = [
  "#f87171",
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#c084fc",
  "#f43f5e",
  "#f97316",
  "#14b8a6",
];

interface UserMenuProps {
  username: string;
}

export default function UserMenu({
  username,
  selectedColor,
  setSelectedColor,
}): any {
  const { theme, setTheme } = useTheme();

  return (
    <div className="fixed top-4 right-4 flex gap-3">
      {/* User Menu Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon">
            <User className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48">
          <p className="text-sm font-medium">Hello, {username || "Guest"}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {colors.map((color) => (
              <button
                key={color}
                className="w-6 h-6 rounded-full border-2"
                style={{
                  backgroundColor: color,
                  borderColor:
                    selectedColor === color ? "black" : "transparent",
                }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Dark Mode Toggle */}
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
    </div>
  );
}
