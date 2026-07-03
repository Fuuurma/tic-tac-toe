import { isConvexConfigured } from "@/app/utils/convex/config";

export const isGoogleOAuthUiEnabled =
  isConvexConfigured && process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true";
