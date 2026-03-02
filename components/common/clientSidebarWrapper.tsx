"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

export const ClientSidebarWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>;
  }

  return <SidebarProvider defaultOpen={true}>{children}</SidebarProvider>;
};
