import { Menu, User } from "lucide-react";
import ThemeTogglerButton from "../menu/themeToggler";
import { SidebarTrigger } from "../ui/sidebar";

// Separate component for header buttons to handle different layouts
export const SidebarHeaderButtons = ({
  isCollapsed,
}: {
  isCollapsed: boolean;
}) => {
  const baseButtonClass =
    "p-2 bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:from-gray-50 hover:to-gray-200 active:shadow-inner active:from-gray-200 active:to-gray-100 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800";

  if (isCollapsed) {
    // Vertical layout for collapsed state
    return (
      <div className="flex flex-col items-center gap-3">
        {/* Sidebar Trigger */}
        <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
          <SidebarTrigger className="p-2 hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-200 active:shadow-inner dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
            <Menu className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </SidebarTrigger>
        </div>

        {/* User Profile Button */}
        <button className={baseButtonClass}>
          <User className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>

        {/* Mode Toggle Button */}
        <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
          <ThemeTogglerButton />
        </div>
      </div>
    );
  }

  // Horizontal layout for expanded state
  return (
    <div className="flex items-center justify-between">
      {/* Sidebar Trigger */}
      <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
        <SidebarTrigger className="p-2 hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-200 active:shadow-inner dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
          <Menu className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </SidebarTrigger>
      </div>

      <div className="flex items-center gap-3">
        {/* User Profile Button */}
        <button className={baseButtonClass}>
          <User className="h-5 w-5 text-gray-700 dark:text-gray-200" />
        </button>

        {/* Mode Toggle Button */}
        <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
          <ThemeTogglerButton />
        </div>
      </div>
    </div>
  );
};
