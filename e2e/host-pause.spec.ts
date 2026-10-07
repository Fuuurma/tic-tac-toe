// The host's pause is the one piece of online session state the guest could
// not see. It needs the REAL relay to be proven: `pause` must not be one of
// the relay's RESERVED_TYPES (or the frame is swallowed and the guest never
// learns), and the guest must stop counting down against a stopped clock.
import { expect, test } from "@playwright/test";
import { onlineSmokeEnabled } from "./matchmaking";

async function fillLobby(
  page: import("@playwright/test").Page,
  options: {
    name: string;
    color: string;
    mode: "Online";
    onlineAction: "Create" | "Join";
    roomId?: string;
    startUrl?: string;
  },
) {
  await page.goto(options.startUrl ?? "/");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page.getByRole("radio", { name: options.onlineAction, exact: true }).click();
  if (options.onlineAction === "Join" && options.roomId) {
    await page.getByLabel("Room code").fill(options.roomId);
  }
  await page.getByRole("button", { name: "Edit your player settings" }).click();
  await page.getByLabel("Name", { exact: true }).fill(options.name);
  await page.getByRole("button", { name: "Close" }).click();
}

test("a host pause reaches the guest across the relay", async ({ browser }) => {
  test.setTimeout(180_000);
  test.skip(
    !(await onlineSmokeEnabled()),
    "Online P2P smoke requires E2E_BASE_URL or a reachable matchmaking Worker",
  );

  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const hostPage = await hostCtx.newPage();
  const guestPage = await guestCtx.newPage();

  await fillLobby(hostPage, {
    name: "Host",
    color: "blue",
    onlineAction: "Create",
  });
  await hostPage.getByRole("button", { name: "Create Room" }).click();

  await expect(hostPage.getByText("Room ready")).toBeVisible({ timeout: 30_000 });
  const roomId = (
    ((await hostPage.getByText(/^Room code \S+/).textContent()) ?? "")
      .replace(/^Room code\s+/, "")
      .trim()
  );
  expect(roomId.length).toBeGreaterThanOrEqual(4);

  await fillLobby(guestPage, {
    name: "Guest",
    color: "red",
    onlineAction: "Join",
    roomId,
    startUrl: `/?room=${roomId}`,
  });
  await guestPage.getByRole("button", { name: "Join Room" }).click();

  const guestBoard = guestPage.getByRole("group", { name: "Tic Tac Toe game board" });
  await expect(hostPage.getByRole("group", { name: "Tic Tac Toe game board" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(guestBoard).toBeVisible({ timeout: 90_000 });

  // The guest's countdown must be running before the pause.
  const guestTimer = guestPage.getByRole("timer");
  await expect(guestTimer).toBeVisible();

  // Host opens its in-game settings — this freezes the host's clock.
  await hostPage.getByRole("button", { name: "Edit player settings" }).click();

  // The guest is told, in words, why the game stopped. This assertion is the
  // proof the frame is relayed rather than dropped by the host.
  await expect(guestPage.getByText("Your host paused the game")).toBeVisible({
    timeout: 15_000,
  });

  // And the guest's own countdown is frozen, not racing the stopped clock.
  const frozen = await guestTimer.getAttribute("aria-label");
  await guestPage.waitForTimeout(2500);
  expect(await guestTimer.getAttribute("aria-label")).toBe(frozen);

  // Closing resumes both sides.
  await hostPage.getByRole("button", { name: "Close" }).click();
  await expect(guestPage.getByText("Your host paused the game")).toBeHidden({
    timeout: 15_000,
  });

  await hostCtx.close();
  await guestCtx.close();
});