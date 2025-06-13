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
import { SidebarHeaderButtons } from "./headerButtons";
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
    description: "Play with friends",
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

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-2 border-gray-300 shadow-lg dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Header with Dynamic Layout */}
      <SidebarHeader className="p-4 bg-gradient-to-b from-gray-50 to-gray-100 border-b-2 border-gray-200 dark:from-gray-800 dark:to-gray-900 dark:border-gray-700">
        {/* Top Section: Header Buttons with Dynamic Layout */}
        <div className="mb-4">
          <SidebarHeaderButtons isCollapsed={isCollapsed} />
        </div>

        {/* Bottom Section: Home Button and Title */}
        {!isCollapsed ? (
          // Full Home Button when expanded
          <button className="w-full p-4 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:from-gray-50 hover:to-gray-100 active:shadow-inner active:from-gray-200 active:to-gray-100 group dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-300 rounded-lg shadow-inner dark:from-blue-900 dark:to-blue-800 dark:border-blue-700">
                <homeItem.icon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-100">
                  {homeItem.title}
                </div>
              </div>
            </div>
          </button>
        ) : (
          // Simple icon button when collapsed (shadcn style)
          <SidebarMenuButton tooltip={homeItem.title} className="w-full">
            <homeItem.icon />
            <span>{homeItem.title}</span>
          </SidebarMenuButton>
        )}
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      {/* Content with Game Modes - Now with flex layout to center and distribute */}
      <SidebarContent className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <SidebarGroup className="px-4 py-6 flex-1 flex flex-col">
          <SidebarGroupContent className="flex-1 flex flex-col">
            <SidebarMenu className="flex-1 flex flex-col justify-center space-y-6">
              {gameModes.map((mode) => (
                <SidebarMenuItem key={mode.title} className="flex-1 flex">
                  <SidebarMenuButton
                    asChild
                    className="h-full w-full p-0 hover:bg-transparent flex-1"
                  >
                    {!isCollapsed ? (
                      // Full game mode button when expanded
                      <button className="w-full h-full p-4 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:from-gray-50 hover:to-gray-100 active:shadow-inner active:from-gray-200 active:to-gray-100 group dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:hover:from-gray-600 dark:hover:to-gray-700 dark:active:bg-gray-800 flex items-center justify-center">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-300 rounded-lg shadow-inner dark:from-blue-900 dark:to-blue-800 dark:border-blue-700">
                            <mode.icon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-100">
                              {mode.title}
                            </div>
                            <div className="text-sm text-gray-600 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300">
                              {mode.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ) : (
                      // Simple icon button when collapsed (shadcn style)
                      <SidebarMenuButton
                        tooltip={mode.title}
                        className="h-full flex-1"
                      >
                        <mode.icon />
                        <span>{mode.title}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      {/* Footer with Player Data */}
      <SidebarFooter className="p-4 bg-gradient-to-t from-gray-100 to-gray-50 border-t-2 border-gray-200 dark:from-gray-900 dark:to-gray-800 dark:border-gray-700">
        {!isCollapsed ? (
          // Full player display when expanded
          <div className="bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg p-4 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600">
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
        ) : (
          // Simple player icons when collapsed
          <div className="space-y-2">
            <SidebarMenuButton tooltip={gameState.players.X.username}>
              <div
                className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center"
                style={{ backgroundColor: gameState.players.X.color }}
              >
                <playerData.player1.icon className="h-3 w-3 text-white" />
              </div>
              <span>{gameState.players.X.username}</span>
            </SidebarMenuButton>
            <SidebarMenuButton tooltip={gameState.players.O.username}>
              <div
                className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center"
                style={{ backgroundColor: gameState.players.O.color }}
              >
                <playerData.player2.icon className="h-3 w-3 text-white" />
              </div>
              <span>{gameState.players.O.username}</span>
            </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
