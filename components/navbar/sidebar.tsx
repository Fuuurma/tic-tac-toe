"use client";

import {
  Home,
  Cpu,
  Globe,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import ThemeTogglerButton from "../menu/themeToggler";
import { SoundToggle } from "../common/soundToggle";
import { GameState } from "@/app/types/types";
import { GameModes } from "@/app/game/constants/constants";
import Link from "next/link";

const gameModes = [
  {
    title: "Vs Computer",
    url: "/",
    icon: Cpu,
    mode: GameModes.VS_COMPUTER,
  },
  {
    title: "Online",
    url: "/",
    icon: Globe,
    mode: GameModes.ONLINE,
  },
  {
    title: "Multiplayer",
    url: "/",
    icon: Users,
    mode: GameModes.VS_FRIEND,
  },
];

interface AppSidebarProps {
  gameState: GameState;
  gameMode?: GameModes;
  isLoggedIn?: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ gameState, gameMode, isLoggedIn }) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const getModeIndex = (mode: GameModes): number => {
    switch (mode) {
      case GameModes.VS_COMPUTER:
        return 0;
      case GameModes.ONLINE:
        return 1;
      case GameModes.VS_FRIEND:
        return 2;
      default:
        return -1;
    }
  };

  const activeModeIndex = gameMode !== undefined ? getModeIndex(gameMode) : -1;
  
  const headerClass = isCollapsed 
    ? "flex flex-col items-center gap-2 py-3 px-1" 
    : "flex flex-col gap-2 py-4";

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className={headerClass}>
        <div className={isCollapsed ? "flex flex-col items-center" : "flex items-center justify-between"}>
          <SidebarTrigger className="h-10 w-10" />
          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <ThemeTogglerButton />
              <SoundToggle />
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Link 
            href="/" 
            className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md hover:bg-accent text-foreground"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        )}
        {isCollapsed && (
          <div className="flex flex-col items-center gap-1">
            <ThemeTogglerButton />
            <SoundToggle />
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {gameModes.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title}
                    className={isLoggedIn && activeModeIndex === index ? "bg-accent" : ""}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={gameState.players.X.username || "Player X"}
              className="h-10"
            >
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center border shrink-0"
                style={{ backgroundColor: gameState.players.X.color }}
              />
              <span className="truncate text-sm">
                {gameState.players.X.username || "Player X"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={gameState.players.O.username || "Player O"}
              className="h-10"
            >
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center border shrink-0"
                style={{ backgroundColor: gameState.players.O.color }}
              />
              <span className="truncate text-sm">
                {gameState.players.O.username || "Player O"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
