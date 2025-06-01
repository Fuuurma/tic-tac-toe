import {
  Home,
  Cpu, // For "Vs Computer"
  Globe, // For "Online"
  Users, // For "Multiplayer"
  PanelLeftClose, // Icon for sidebar trigger when open
  PanelRightClose, // Icon for sidebar trigger when closed (or just one that rotates)
} from "lucide-react";

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

export function AppSidebar() {
  return (
    <Sidebar
      collapsible="icon"
      className="neumorphic-bg text-neutral-700 border-r neumorphic-border"
    >
      <SidebarHeader className="p-4 flex items-center justify-between neumorphic-header-shadow">
        <div className="flex items-center gap-3">
          {/* Home button - icon only when collapsed, icon + text when open */}
          <SidebarMenuButton asChild className="neumorphic-button-iconOnly">
            <a href={homeItem.url}>
              <homeItem.icon className="h-5 w-5" />
              <span className="sr-only">{homeItem.title}</span>
            </a>
          </SidebarMenuButton>
          {/* Title - only shown when sidebar is open */}
          <h1 className="text-xl font-semibold sidebar-open:inline hidden">
            Tic Tac Toe
          </h1>
        </div>
        <SidebarTrigger className="neumorphic-button-iconOnly" />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarMenu>
          {/* Game Modes Section */}
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
                  {/* Text only shown when sidebar is open */}
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
