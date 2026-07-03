import { describe, expect, it } from "vitest";
import { getGoogleOAuthReadiness } from "@/app/utils/auth/authConfig";

describe("getGoogleOAuthReadiness", () => {
  it("keeps Google OAuth hidden unless the public flag is enabled", () => {
    expect(
      getGoogleOAuthReadiness({
        flagEnabled: false,
        convexConfigured: true,
      })
    ).toBe("hidden");
  });

  it("marks Google OAuth as waiting for Convex when only the flag is enabled", () => {
    expect(
      getGoogleOAuthReadiness({
        flagEnabled: true,
        convexConfigured: false,
      })
    ).toBe("needs-convex");
  });

  it("marks Google OAuth as ready when the flag and Convex are configured", () => {
    expect(
      getGoogleOAuthReadiness({
        flagEnabled: true,
        convexConfigured: true,
      })
    ).toBe("ready");
  });
});
