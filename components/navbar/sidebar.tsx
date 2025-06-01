import {
  Home,
  Cpu, // For "Vs Computer"
  Globe, // For "Online"
  Users, // For "Multiplayer"
  PanelLeftClose, // Icon for sidebar trigger when open
  PanelRightClose,
  Menu, // Icon for sidebar trigger when closed (or just one that rotates)
} from "lucide-react";

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

export function AppSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      className="border-r-2 border-gray-300 shadow-lg"
    >
      {/* Header with Home Button, Title, and Trigger */}
      <SidebarHeader className="p-4 bg-gradient-to-b from-gray-50 to-gray-100 border-b-2 border-gray-200">
        {/* Top Section: SidebarTrigger, UserProfile, ModeToggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {/* Sidebar Trigger */}
            <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
              <SidebarTrigger className="p-2 hover:bg-gradient-to-b hover:from-gray-50 hover:to-gray-200 active:shadow-inner">
                <Menu className="h-5 w-5 text-gray-700" />
              </SidebarTrigger>
            </div>
            {/* User Profile Button */}
            <button className="p-2 bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:from-gray-50 hover:to-gray-200 active:shadow-inner active:from-gray-200 active:to-gray-100">
              <User className="h-5 w-5 text-gray-700" />
            </button>
            {/* Mode Toggle Button */}
            <div className="bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200">
              <ThemeTogglerButton />
            </div>
          </div>
        </div>
        {/* Bottom Section: Home Button and Title */}
        <div className="flex items-center gap-3">
          <button className="p-2 bg-gradient-to-b from-white to-gray-100 border-2 border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:from-gray-50 hover:to-gray-200 active:shadow-inner active:from-gray-200 active:to-gray-100">
            <Home className="h-5 w-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-800 drop-shadow-sm">
            Tic Tac Toe
          </h1>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="border-gray-300" />

      {/* Content with Game Modes */}
      <SidebarContent className="bg-gradient-to-b from-gray-50 to-white">
        <SidebarGroup className="px-4 py-6">
          <SidebarGroupLabel className="text-lg font-semibold text-gray-700 mb-4 drop-shadow-sm">
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
                    <button className="w-full p-4 bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:from-gray-50 hover:to-gray-100 active:shadow-inner active:from-gray-200 active:to-gray-100 group">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gradient-to-b from-blue-100 to-blue-200 border border-blue-300 rounded-lg shadow-inner">
                          <mode.icon className="h-5 w-5 text-blue-700" />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-gray-800 group-hover:text-gray-900">
                            {mode.title}
                          </div>
                          <div className="text-sm text-gray-600 group-hover:text-gray-700">
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

      <SidebarSeparator className="border-gray-300" />

      {/* Footer with Player Data */}
      <SidebarFooter className="p-4 bg-gradient-to-t from-gray-100 to-gray-50 border-t-2 border-gray-200">
        <div className="bg-gradient-to-b from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 drop-shadow-sm">
            Players
          </h3>
          <div className="space-y-3">
            {/* Player 1 */}
            <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg shadow-inner">
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-md flex items-center justify-center"
                style={{ backgroundColor: playerData.player1.color }}
              >
                <playerData.player1.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-800">
                {playerData.player1.name}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-300 opacity-50"></div>

            {/* Player 2 */}
            <div className="flex items-center gap-3 p-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-lg shadow-inner">
              <div
                className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-md flex items-center justify-center"
                style={{ backgroundColor: playerData.player2.color }}
              >
                <playerData.player2.icon className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-800">
                {playerData.player2.name}
              </span>
            </div>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

const PlayerInfoDisplay: React.FC<{ player: PlayerData }> = ({ player }) => (
  <div className="flex items-center space-x-3 p-2 rounded-md neumorphic-inset-element">
    <div
      className={`h-7 w-7 rounded-full ${player.colorClass} neumorphic-player-indicator flex-shrink-0 border-2 border-white/50`}
    ></div>
    <span className="text-sm font-medium truncate">{player.name}</span>
  </div>
);

/*
  export function AppSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      className="neumorphic-bg text-neutral-700 border-r neumorphic-border"
    >
      <SidebarHeader className="p-4 flex items-center justify-between neumorphic-header-shadow">
        <div className="flex items-center gap-3">
          <SidebarMenuButton asChild className="neumorphic-button-iconOnly">
            <a href={homeItem.url}>
              <homeItem.icon className="h-5 w-5" />
              <span className="sr-only">{homeItem.title}</span>
            </a>
          </SidebarMenuButton>
          <h1 className="text-xl font-semibold sidebar-open:inline hidden">
            Tic Tac Toe
          </h1>
        </div>
        <SidebarTrigger className="neumorphic-button-iconOnly" />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu>
          {gameModeItems.map((item) => (
            <SidebarMenuItem key={item.title} className="mb-1">
              <SidebarMenuButton
                asChild
                className="w-full justify-start neumorphic-button"
              >
                <a
                  href={item.url}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className="sidebar-open:inline hidden truncate">
                    {item.title}
                  </span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>My Footer</SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}


*/
