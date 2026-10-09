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
  await page.getByLabel("Your name", { exact: true }).fill(name);
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

  // Host starts a quick match.
  await configureQuickPlayer(hostPage, "Host");
  await hostPage.getByRole("button", { name: "Quick Match" }).click();

  // Guest starts a quick match
  await configureQuickPlayer(guestPage, "Guest");
  await guestPage.getByRole("button", { name: "Quick Match" }).click();

  // Both reach the board and connect
  await expect(hostPage.getByRole("group", { name: /^Guest,/ })).toBeVisible({ timeout: 90_000 });
  await expect(guestPage.getByRole("group", { name: /^Host,/ })).toBeVisible({ timeout: 90_000 });

  // A quick match is paired by the service, so its room is never an
  // invitation for a third person: no share banner, no copy buttons, and no
  // code chip in the HUD — on either side. Asserted here rather than mid-
  // search because with a warm queue the pairing can complete before the
  // "Finding an opponent…" state is ever observable, and a test that waits
  // for a spinner races the match instead of checking the rule.
  for (const page of [hostPage, guestPage]) {
    await expect(page.getByText("Room ready")).toBeHidden();
    await expect(page.getByRole("button", { name: /Copy code/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Copy invite link/ })).toHaveCount(0);
    await expect(page.getByLabel(/Room code/)).toHaveCount(0);
  }

  // Host plays top-left
  await hostPage.getByRole("button", { name: "Row 1 column 1" }).click();
  await expect(
    guestPage.getByRole("button", { name: "Row 1 column 1" }),
  ).toHaveAttribute("aria-label", /occupied by X/);

  await host.close();
  await guest.close();
});
