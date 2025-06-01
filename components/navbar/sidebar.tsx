import {
  Home,
  Cpu, // For "Vs Computer"
  Globe, // For "Online"
  Users, // For "Multiplayer"
  PanelLeftClose, // Icon for sidebar trigger when open
  PanelRightClose,
  Menu, // Icon for sidebar trigger when closed (or just one that rotates)
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";

import { Monitor, User, Bot } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ThemeTogglerButton from "../menu/themeToggler";
import { GameState } from "@/app/types/types";

//
// Menu items.
// Change icons.
// asign state functions.
// make buttons skeumorphism

const homeItem = {
  title: "Home",
  url: "/",
  icon: Home,
};

const gameModeItems = [
  {
    title: "Vs Computer",
    url: "/play/vs-computer", // Use actual routes
    icon: Cpu,
  },
  {
    title: "Online",
    url: "/play/online",
    icon: Globe,
  },
  {
    title: "Multiplayer", // Assuming local multiplayer
    url: "/play/multiplayer",
    icon: Users,
  },
];

// Game mode items with appropriate icons
const gameModes = [
  {
    title: "Vs Computer",
    url: "#",
    icon: Monitor,
    description: "Play against AI",
  },
  {
    title: "Online",
    url: "#",
    icon: Globe,
    description: "Play with friends online",
  },
  {
    title: "Multiplayer",
    url: "#",
    icon: Users,
    description: "Local multiplayer",
  },
];

// Player data (you can make this dynamic with props or state)
const playerData = {
  player1: {
    name: "You",
    color: "#3b82f6", // blue
    icon: User,
  },
  player2: {
    name: "Computer",
    color: "#ef4444", // red
    icon: Bot,
  },
};

// if sidebar state === collapsed,
// then show header buttons as vertical instead of horizontal
// Use Tailwind styles for both (light & dark modes)
// shadcn styles have already by default styles for both.
// take that into account.
// Header - Home will be 1 full container (icon + title)
// like the content ones.

interface AppSidebarProps {
  gameState: GameState;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ gameState }) => {
  const {
    state,
    open,
    setOpen,
    openMobile,
    setOpenMobile,
    isMobile,
    toggleSidebar,
  } = useSidebar();

  if (state === "collapsed") {
    // the sidebarHeaderButtons will be Vertical, otherwise horizontal: 2 components:
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-2 border-gray-300 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Header with Home Button, Title, and Trigger */}
      <SidebarHeader className="p-4 bg-gradient-to-b from-gray-50 to-gray-100 border-b-2 border-gray-200 dark:from-gray-800 dark:to-gray-900 dark:border-gray-700">
        {/* Top Section: SidebarTrigger, UserProfile, ModeToggle */}
        <div className="mb-4 data-[state=collapsed]:flex data-[state=collapsed]:flex-col data-[state=collapsed]:items-center data-[state=collapsed]:gap-3 data-[state=expanded]:flex data-[state=expanded]:items-center data-[state=expanded]:justify-between">
          {/* Sidebar Trigger */}
          <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
            <SidebarTrigger className="p-2 hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-200 active:shadow-inner dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
              <Menu className="h-5 w-5 text-gray-700 dark:text-gray-200" />
            </SidebarTrigger>
          </div>
          {/* User Profile Button */}
          <button className="p-2 bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:from-gray-50 hover:to-gray-200 active:shadow-inner active:from-gray-200 active:to-gray-100 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
            <User className="h-5 w-5 text-gray-700 dark:text-gray-200" />
          </button>
          {/* Mode Toggle Button */}
          <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
            <ThemeTogglerButton />
          </div>
        </div>
        {/* Bottom Section: Home Button and Title (Full Container) */}
        <button className="w-full p-4 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:from-gray-50 hover:to-gray-100 active:shadow-inner active:from-gray-200 active:to-gray-100 group dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-300 rounded-lg shadow-inner dark:from-blue-900 dark:to-blue-800 dark:border-blue-700">
              <homeItem.icon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div className="text-left data-[state=collapsed]:hidden">
              <div className="font-semibold text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-100">
                {homeItem.title}
              </div>
            </div>
          </div>
        </button>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Content with Game Modes */}
      <SidebarContent className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <SidebarGroup className="px-4 py-6">
          <SidebarGroupLabel className="text-lg font-semibold text-gray-700 mb-4 drop-shadow-sm dark:text-gray-200">
            Game Modes
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-3">
              {gameModes.map((mode) => (
                <SidebarMenuItem key={mode.title}>
                  <SidebarMenuButton
                    asChild
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    <button className="w-full p-4 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:from-gray-50 hover:to-gray-100 active:shadow-inner active:from-gray-200 active:to-gray-100 group dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-300 rounded-lg shadow-inner dark:from-blue-900 dark:to-blue-800 dark:border-blue-700">
                          <mode.icon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        </div>
                        <div className="text-left data-[state=collapsed]:hidden">
                          <div className="font-semibold text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-100">
                            {mode.title}
                          </div>
                          <div className="text-sm text-gray-600 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300">
                            {mode.description}
                          </div>
                        </div>
                      </div>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer with Player Data */}
      <SidebarFooter className="p-4 bg-gradient-to-t from-gray-100 to-gray-50 border-t-2 border-gray-200 dark:from-gray-900 dark:to-gray-800 dark:border-gray-700">
        <div className="bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg p-4 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 drop-shadow-sm dark:text-gray-200">
            Players
          </h3>
          <div className="space-y-3">
            {/* Player 1 */}
            <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg shadow-inner dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-md flex items-center justify-center dark:border-gray-600"
                style={{ backgroundColor: gameState.players.X.color }}
              >
                <playerData.player1.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {gameState.players.X.username}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-300 opacity-50 dark:border-gray-600"></div>

            {/* Player 2 */}
            <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg shadow-inner dark:from-gray-800 dark:to-gray-700 dark:border-gray-600">
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-md flex items-center justify-center dark:border-gray-600"
                style={{ backgroundColor: gameState.players.O.color }}
              >
                <playerData.player2.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {gameState.players.O.username}
              </span>
            </div>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
