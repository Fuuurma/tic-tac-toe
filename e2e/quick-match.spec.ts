import { expect, test } from "@playwright/test";
import { onlineSmokeEnabled } from "./matchmaking";

async function configureQuickPlayer(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.goto("/");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page.getByRole("radio", { name: "Quick", exact: true }).click();
  await page.getByRole("button", { name: "Edit your player settings" }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Close" }).click();
}

test("quick match pairs two players", async ({ browser }) => {
  test.setTimeout(120_000);
  test.skip(!(await onlineSmokeEnabled()), "Matchmaking Worker unreachable in this environment");

  const host = await browser.newContext();
  const guest = await browser.newContext();
  await host.addInitScript(() => {
    Math.random = () => 0.25;
  });
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  // Host starts a quick match — the host sees the "Finding an opponent…"
  // connection state until the relay completes the pairing.
  await configureQuickPlayer(hostPage, "Host");
  await hostPage.getByRole("button", { name: "Quick Match" }).click();
  await expect(hostPage.getByText(/Finding an opponent…|Room ready/)).toBeVisible({
    timeout: 30_000,
  });

  // Guest starts a quick match
  await configureQuickPlayer(guestPage, "Guest");
  await guestPage.getByRole("button", { name: "Quick Match" }).click();

  // Both reach the board and connect
  await expect(hostPage.getByRole("group", { name: /^Guest,/ })).toBeVisible({ timeout: 90_000 });
  await expect(guestPage.getByRole("group", { name: /^Host,/ })).toBeVisible({ timeout: 90_000 });

  // Host plays top-left
  await hostPage.getByRole("gridcell", { name: "Row 1 column 1" }).click();
  await expect(
    guestPage.getByRole("gridcell", { name: "Row 1 column 1" }),
  ).toHaveAttribute("aria-label", /occupied by X/);

  await host.close();
  await guest.close();
});
