import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { Color, COLOR_VARIANTS } from "@/app/game/constants/constants";

interface UserMenuPopoverProps {
  username?: string;
  selectedColor: Color;
  setSelectedColor: (color: Color) => void;
}

const UserMenuPopover: React.FC<UserMenuPopoverProps> = ({
  username,
  selectedColor,
  setSelectedColor,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`relative ${COLOR_VARIANTS[selectedColor].border}`}
        >
          <User className={`w-5 h-5 ${COLOR_VARIANTS[selectedColor].text}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className={`w-5 h-5 ${COLOR_VARIANTS[selectedColor].text}`} />
            <p className="text-sm font-medium">Hello, {username || "Guest"}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select your preferred color:
            </p>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(COLOR_VARIANTS).map(([colorKey, colorValue]) => {
                const color = colorKey as Color;
                return (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full transition-all ${
                      colorValue.bg
                    } ${colorValue.border}
                    ${
                      selectedColor === color
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                        : "hover:scale-105"
                    }`}
                    onClick={() => setSelectedColor(color)}
                    title={capitalizeFirstLetter(color)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

export default UserMenuPopover;
