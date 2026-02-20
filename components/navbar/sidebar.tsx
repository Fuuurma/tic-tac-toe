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
import { GameState } from "@/app/types/types";
import Link from "next/link";

const gameModes = [
  {
    title: "Vs Computer",
    url: "/",
    icon: Cpu,
  },
  {
    title: "Online",
    url: "/",
    icon: Globe,
  },
  {
    title: "Multiplayer",
    url: "/",
    icon: Users,
  },
];

interface AppSidebarProps {
  gameState: GameState;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ gameState }) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className={isCollapsed ? "py-3" : "py-4"}>
        <div className="flex items-center gap-2">
          <SidebarTrigger className="h-9 w-9" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Home">
                <Link href="/">
                  <Home className="h-5 w-5" />
                  {!isCollapsed && <span>Home</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {!isCollapsed && <ThemeTogglerButton />}
        </div>
        {isCollapsed && (
          <div className="mt-2">
            <ThemeTogglerButton />
          </div>
        )}
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {gameModes.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
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
