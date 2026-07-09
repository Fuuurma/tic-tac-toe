"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { convexUrl } from "@/app/utils/convex/config";

const ConvexClientProvider = dynamic(
  () =>
    import("./convexClientProvider").then((m) => m.ConvexClientProvider),
  { ssr: false },
);

export function OptionalConvexProvider({ children }: { children: ReactNode }) {
  if (!convexUrl) {
    return <>{children}</>;
  }

  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
