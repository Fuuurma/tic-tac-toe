import { isConvexConfigured } from "@/app/utils/convex/config";

export type GoogleOAuthReadiness = "hidden" | "needs-convex" | "ready";

interface GoogleOAuthReadinessOptions {
  flagEnabled?: boolean;
  convexConfigured?: boolean;
}

export const isGoogleOAuthFlagEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";

export const getGoogleOAuthReadiness = ({
  flagEnabled = isGoogleOAuthFlagEnabled,
  convexConfigured = isConvexConfigured,
}: GoogleOAuthReadinessOptions = {}): GoogleOAuthReadiness => {
  if (!flagEnabled) return "hidden";
  return convexConfigured ? "ready" : "needs-convex";
};

export const googleOAuthReadiness = getGoogleOAuthReadiness();
