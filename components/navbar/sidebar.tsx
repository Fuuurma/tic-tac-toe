"use client";

import {
  Home,
  Cpu,
  Globe,
  Users,
  Monitor,
  Bot,
  User,
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
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import ThemeTogglerButton from "../menu/themeToggler";
import { GameState } from "@/app/types/types";

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

const playerData = {
  player1: {
    name: "You",
    icon: User,
  },
  player2: {
    name: "Computer",
    icon: Bot,
  },
};

interface AppSidebarProps {
  gameState: GameState;
}

function SidebarHeaderContent({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between p-2">
        {!isCollapsed && (
          <span className="font-semibold text-sm">Tic Tac Toe</span>
        )}
        <ThemeTogglerButton />
      </div>
      <SidebarMenuButton asChild className="h-10">
        <a href="/">
          <Home className="h-5 w-5" />
          <span>Home</span>
        </a>
      </SidebarMenuButton>
    </>
  );
}

function GameModeItems({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {gameModes.map((mode) => (
            <SidebarMenuItem key={mode.title}>
              <SidebarMenuButton asChild tooltip={mode.title}>
                <a href={mode.url} className="w-full">
                  <mode.icon className="h-5 w-5" />
                  {!isCollapsed && (
                    <div className="flex flex-col">
                      <span>{mode.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {mode.description}
                      </span>
                    </div>
                  )}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function PlayerInfo({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={gameState.players.X.username || "Player X"}>
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center border"
            style={{ backgroundColor: gameState.players.X.color }}
          >
            <playerData.player1.icon className="h-3 w-3 text-white" />
          </div>
          {!isCollapsed && (
            <span className="truncate">
              {gameState.players.X.username || "Player X"}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={gameState.players.O.username || "Player O"}>
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center border"
            style={{ backgroundColor: gameState.players.O.color }}
          >
            <playerData.player2.icon className="h-3 w-3 text-white" />
          </div>
          {!isCollapsed && (
            <span className="truncate">
              {gameState.players.O.username || "Player O"}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Need to reference gameState inside the component
let gameState: GameState;

export const AppSidebar: React.FC<AppSidebarProps> = ({ gameState: propGameState }) => {
  gameState = propGameState;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarHeaderContent isCollapsed={isCollapsed} />
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <GameModeItems isCollapsed={isCollapsed} />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <PlayerInfo isCollapsed={isCollapsed} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
