import { expect, test as base } from "@playwright/test";
import { skipOnboarding } from "./skipOnboarding";

/** `test`, with onboarding already dismissed in the default context. */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await skipOnboarding(context);
    await provide(context);
  },
});

export { expect };
