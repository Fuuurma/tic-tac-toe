"use client";

import { useMemo, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";
import { AuthSessionBridge } from "./authSessionBridge";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const client = useMemo(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
    [],
  );
  return (
    <ConvexBetterAuthProvider client={client} authClient={authClient}>
      {children}
      <AuthSessionBridge />
    </ConvexBetterAuthProvider>
  );
}
