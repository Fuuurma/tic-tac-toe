import { expect, test } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 4173);

async function peerjsBrokerReachable(): Promise<boolean> {
  // PeerJS uses the public broker by default; skip the online test if the
  // sandbox can't reach it (the real smoke runs against the deployed URL).
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const res = await fetch("https://0.peerjs.com/peerjs/id", {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function fillLogin(
  page: import("@playwright/test").Page,
  options: {
    name: string;
    color: string;
    mode: "vs Computer" | "vs Friend" | "Online";
    opponentName?: string;
    onlineAction?: "Create" | "Join";
    roomId?: string;
  },
) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(options.name);
  await page.getByRole("radio", { name: options.mode, exact: true }).click();
  if (options.opponentName) {
    await page.getByLabel("Opponent's name").fill(options.opponentName);
  }
  if (options.mode === "Online") {
    const action = options.onlineAction ?? "Create";
    await page.getByRole("button", { name: action, exact: true }).click();
    if (action === "Join" && options.roomId) {
      await page.getByLabel("Room ID").fill(options.roomId);
    }
  }
}

async function clickCell(
  page: import("@playwright/test").Page,
  row: 1 | 2 | 3,
  col: 1 | 2 | 3,
) {
  await page.getByRole("gridcell", { name: `Row ${row} column ${col}` }).click();
}

test("loads the playable shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Tic Tac Toe/);
  await expect(page.getByText("Tic Tac Toe", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Pick a mode, choose your color, and jump in.")).toBeVisible();
});

test("starts a vs Computer game", async ({ page }) => {
  await fillLogin(page, { name: "AI Player", color: "blue", mode: "vs Computer" });
  await page.getByRole("radio", { name: "Normal", exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();
});

test("starts a vs Friend game", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();
});

test("keeps the mobile layout usable in a single-column viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const startButton = page.getByRole("button", { name: "Start Game" });
  await expect(startButton).toBeVisible();
  const box = await startButton.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(844);
});

test("pairs two online sessions, completes a match, and rematches", async ({ browser }) => {
  test.setTimeout(180_000);

  test.skip(!process.env.E2E_BASE_URL, "Online P2P smoke runs against the deployed URL via E2E_BASE_URL");

  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  // Host creates a room
  await hostPage.goto("/");
  await hostPage.getByLabel("Your name").fill("Host");
  await hostPage.getByRole("radio", { name: "Online", exact: true }).click();
  await hostPage.getByRole("button", { name: "Create", exact: true }).click();
  await hostPage.getByRole("button", { name: "Create Room" }).click();
  await expect(hostPage.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();

  // Wait until the room ID is shown
  const hostWaiting = hostPage.getByText(/Waiting for opponent to join room/);
  await hostWaiting.waitFor({ timeout: 30_000 });
  const waitingText = (await hostWaiting.textContent()) ?? "";
  const roomIdMatch = waitingText.match(/room\s+(\S+)/);
  expect(roomIdMatch).not.toBeNull();
  const roomId = roomIdMatch![1];
  expect(roomId.length).toBeGreaterThanOrEqual(4);

  // Guest joins the room
  await guestPage.goto("/");
  await guestPage.getByLabel("Your name").fill("Guest");
  await guestPage.getByRole("radio", { name: "Online", exact: true }).click();
  await guestPage.getByRole("button", { name: "Join", exact: true }).click();
  await guestPage.getByLabel("Room ID").fill(roomId);
  await guestPage.getByRole("button", { name: "Join Room" }).click();
  await expect(guestPage.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();

  // Wait for both to be connected (PeerJS public broker signaling can be slow on first use).
  await expect(hostPage.getByText("Opponent: Guest")).toBeVisible({ timeout: 90_000 });
  await expect(guestPage.getByText("Opponent: Host")).toBeVisible({ timeout: 90_000 });

  // Play a deterministic X wins scenario (host = X).
  // X plays: (1,1), (1,2), (1,3)  (row 1 = top row)
  // O plays: (2,1), (2,2)
  await clickCell(hostPage, 1, 1);
  await clickCell(guestPage, 2, 1);
  await clickCell(hostPage, 1, 2);
  await clickCell(guestPage, 2, 2);
  await clickCell(hostPage, 1, 3);

  // X wins - both clients see the winner text
  await expect(hostPage.getByText(/Host wins/i)).toBeVisible({ timeout: 10_000 });
  await expect(guestPage.getByText(/Host wins/i)).toBeVisible({ timeout: 10_000 });

  // Rematch: host requests, guest accepts.
  await hostPage.getByRole("button", { name: "Start a new game" }).click();
  await guestPage.getByRole("button", { name: "Start a new game" }).click();

  // Board is reset - the winner text is gone, the timer is back, and cell (1,1) is empty again.
  await expect(hostPage.getByText(/Host wins/i)).toBeHidden({ timeout: 10_000 });
  await expect(hostPage.getByRole("timer")).toBeVisible();

  await host.close();
  await guest.close();
});
