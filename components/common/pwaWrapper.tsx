"use client";

import { useServiceWorker } from "@/app/hooks/useServiceWorker";

export const PWAWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useServiceWorker();
  return <>{children}</>;
};
