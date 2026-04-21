"use client";

import { SidebarProvider } from "@/components/ui/sidebar";

export const ClientSidebarWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>;
};
