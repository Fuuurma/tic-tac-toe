"use client";

import { useMemo, type ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { convexUrl } from "@/app/utils/convex/config";

interface OptionalConvexProviderProps {
  children: ReactNode;
}

export function OptionalConvexProvider({ children }: OptionalConvexProviderProps) {
  const client = useMemo(
    () => (convexUrl ? new ConvexReactClient(convexUrl) : null),
    []
  );

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
