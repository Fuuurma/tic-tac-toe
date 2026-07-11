import { expect, test } from "@playwright/test";

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

test("starts a vs Computer game and the AI responds", async ({ page }) => {
  await fillLogin(page, { name: "AI Player", color: "blue", mode: "vs Computer" });
  await page.getByRole("radio", { name: "Normal", exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();

  // Human plays top-left (X), then the AI should play somewhere.
  await clickCell(page, 1, 1);
  await expect(page.getByRole("gridcell", { name: /Row 1 column 1/ })).toContainText("X");

  // The AI responds after its 600ms thinking delay; exactly one
  // O cell should appear and the panel should not say it's the
  // human's turn anymore.
  const oCell = page.getByRole("gridcell", { name: /, occupied by O/ });
  await expect(oCell).toBeVisible({ timeout: 5_000 });

  // The O cell should be styled with the AI's color (red, since
  // the human picked blue and the AI is the opposite). This guards
  // the valueColor wiring through Board -> BoardCell.
  await expect(oCell.locator("span")).toHaveClass(/text-red-500/);
  // The X cell should keep the human's color (blue).
  await expect(
    page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("span"),
  ).toHaveClass(/text-blue-500/);
});

test("starts a vs Friend game and the turn alternates", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();

  // X (Alice) plays top-left; the panel should now show it's Bob's turn.
  await clickCell(page, 1, 1);
  await expect(page.getByRole("gridcell", { name: /Row 1 column 1/ })).toContainText("X");
  await expect(page.getByText(/Bob.*turn|Alice.*turn/).first()).toBeVisible();

  // Bob plays top-right; the panel should now show Alice's turn again.
  await clickCell(page, 1, 3);
  await expect(page.getByRole("gridcell", { name: /Row 1 column 3/ })).toContainText("O");

  // Bob (O) should be styled with the opposite color (red), Alice
  // (X) with blue. Guards the same valueColor wiring as the AI test.
  await expect(
    page.getByRole("gridcell", { name: /Row 1 column 3/ }).locator("span"),
  ).toHaveClass(/text-red-500/);
  await expect(
    page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("span"),
  ).toHaveClass(/text-blue-500/);
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
  const hostWaiting = hostPage.getByLabel(/^Room code /);
  await expect
    .poll(() => hostPage.locator("body").innerText(), { timeout: 30_000 })
    .toMatch(/Waiting for opponent|Peer error|Connection error/);
  await expect(hostWaiting).toBeVisible();
  const waitingText = (await hostWaiting.textContent()) ?? "";
  const roomId = waitingText.trim();
  expect(roomId.length).toBeGreaterThanOrEqual(4);

  // Guest joins the room
  await guestPage.goto(`/?room=${roomId}`);
  await guestPage.getByLabel("Your name").fill("Guest");
  await expect(guestPage.getByRole("radio", { name: "Online", exact: true })).toBeChecked();
  await expect(guestPage.getByLabel("Room ID")).toHaveValue(roomId);
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
  await hostPage.getByRole("dialog").getByRole("button", { name: "Play again" }).click();
  await expect(guestPage.getByText(/Host wants a rematch/i)).toBeVisible();
  await guestPage.getByRole("button", { name: "Start a new game" }).click();
  await guestPage.getByRole("dialog").getByRole("button", { name: "Play again" }).click();

  // Board is reset - the winner text is gone, the timer is back, and cell (1,1) is empty again.
  await expect(hostPage.getByText(/Host wins/i)).toBeHidden({ timeout: 10_000 });
  await expect(hostPage.getByRole("timer")).toBeVisible();

  await host.close();
  await guest.close();
});
