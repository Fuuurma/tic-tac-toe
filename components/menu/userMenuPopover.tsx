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
  selectedColor: () => void;
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
        <Button variant="outline" size="icon">
          <User className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <p className="text-sm font-medium">Hello, {username || "Guest"}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          // add the types. make the map work
          {COLOR_VARIANTS.map((color: any) => (
            <button
              key={color}
              className="w-6 h-6 rounded-full border-2"
              style={{
                backgroundColor: color.bg,
                borderColor: color.border,
              }}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default UserMenuPopover;
