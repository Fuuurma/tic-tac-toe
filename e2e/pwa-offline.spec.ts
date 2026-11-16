import { expect, test } from "./fixtures";

/**
 * The PWA promise: after one online visit the app shell is precached, so a
 * local game keeps working with the network gone. This spec goes dark after
 * the service worker takes control and proves the lobby and a vs-Computer
 * move still run — the two surfaces the offline cache exists for.
 */
test("app shell and a local game work offline", async ({ page, context }) => {
  await page.goto("/");

  // Wait until the worker is active and controlling, so the precache is
  // complete before the network disappears.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload();

  // The lobby renders from the precached shell.
  const start = page.getByRole("button", { name: "Start Game" });
  await expect(start).toBeVisible();

  // vs Computer is the default mode and needs no network at all.
  await start.click();

  const firstCell = page.getByRole("button", { name: /Row 1 column 1/ });
  await expect(firstCell).toBeVisible();
  await firstCell.click();

  // The move landed: the cell now reports an occupant instead of "empty".
  await expect(
    page.getByRole("button", { name: /Row 1 column 1, occupied/ }),
  ).toBeVisible();
});
