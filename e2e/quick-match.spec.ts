import { expect, test } from "@playwright/test";

const MATCHMAKING_URL =
  process.env.VITE_MATCHMAKING_URL ?? "http://localhost:8787";

async function matchmakingReachable(): Promise<boolean> {
  // Quick match depends on the matchmaking Worker. Skip when it's not
  // running (the real smoke runs against the deployed Worker via
  // VITE_MATCHMAKING_URL / E2E_BASE_URL).
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const res = await fetch(MATCHMAKING_URL, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

test("quick match pairs two players", async ({ browser }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.E2E_BASE_URL && !(await matchmakingReachable()), "Matchmaking Worker unreachable in this environment");

  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  // Host starts a quick match
  await hostPage.goto("/");
  await hostPage.getByLabel("Your name").fill("Host");
  await hostPage.getByRole("radio", { name: "Online", exact: true }).click();
  await hostPage.getByRole("button", { name: "Quick", exact: true }).click();
  await hostPage.getByRole("button", { name: "Quick Match" }).click();
  await expect(hostPage.getByText(/Waiting for opponent|Finding match|Opponent: Guest/)).toBeVisible({ timeout: 30_000 });

  // Guest starts a quick match
  await guestPage.goto("/");
  await guestPage.getByLabel("Your name").fill("Guest");
  await guestPage.getByRole("radio", { name: "Online", exact: true }).click();
  await guestPage.getByRole("button", { name: "Quick", exact: true }).click();
  await guestPage.getByRole("button", { name: "Quick Match" }).click();

  // Both reach the board and connect
  await expect(hostPage.getByText("Opponent: Guest")).toBeVisible({ timeout: 90_000 });
  await expect(guestPage.getByText("Opponent: Host")).toBeVisible({ timeout: 90_000 });

  // Host plays top-left
  await hostPage.getByRole("gridcell", { name: "Row 1 column 1" }).click();
  await expect(guestPage.getByRole("gridcell", { name: "Row 1 column 1" })).toContainText("X");

  await host.close();
  await guest.close();
});
