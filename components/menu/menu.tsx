import HelpButton from "./helpButton";
import ThemeTogglerButton from "./themeToggler";
import UserMenuPopover from "./userMenuPopover";
import { Color } from "@/app/game/constants/constants";

interface UserMenuProps {
  username?: string;
  selectedColor: Color;
  setSelectedColor: (color: Color) => void;
}

const UserMenu: React.FC<UserMenuProps> = ({
  username,
  selectedColor,
  setSelectedColor,
}) => {
  return (
    <div className="flex gap-2 md:gap-3">
      <HelpButton />

      <UserMenuPopover
        username={username}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
      />

      <ThemeTogglerButton />
    </div>
  );
};

export default UserMenu;
