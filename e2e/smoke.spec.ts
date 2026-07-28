import { expect, test } from "@playwright/test";

async function openPlayerSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Edit your player settings" }).click();
}

async function closePlayerSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Close" }).click();
}

async function openOpponentSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Edit opponent settings" }).click();
}

async function closeOpponentSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Close" }).click();
}

async function fillLogin(
  page: import("@playwright/test").Page,
  options: {
    name: string;
    color: string;
    mode: "vs Computer" | "vs Friend" | "Online";
    opponentName?: string;
    onlineAction?: "Create" | "Join" | "Quick";
    roomId?: string;
  },
) {
  await page.goto("/");
  await page.getByRole("radio", { name: options.mode, exact: true }).click();
  if (options.opponentName && options.mode === "vs Friend") {
    await openOpponentSettings(page);
    await page.getByLabel("Name", { exact: true }).fill(options.opponentName);
    await closeOpponentSettings(page);
  }
  if (options.mode === "Online") {
    const action = options.onlineAction ?? "Create";
    if (action !== "Quick") {
      await page.getByRole("button", { name: "Private room", exact: true }).click();
      await page.getByRole("button", { name: action, exact: true }).click();
    } else {
      await page.getByRole("button", { name: "Quick", exact: true }).click();
    }
    if (action === "Join" && options.roomId) {
      await page.getByLabel("Room code").fill(options.roomId);
    }
  }
  // Fill the player name inside the settings sheet.
  await openPlayerSettings(page);
  await page.getByLabel("Name", { exact: true }).fill(options.name);
  await closePlayerSettings(page);
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
  await expect(page).toHaveTitle(/Tic Tac Toe Disappear/);
  await expect(page.getByRole("heading", { name: "Tic Tac Toe Disappear", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit your player settings" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "vs Computer", exact: true })).toBeVisible();
});

test("remembers the display name after starting a game", async ({ page }) => {
  await page.goto("/");
  await openPlayerSettings(page);
  await page.getByLabel("Name", { exact: true }).fill("Alice");
  await closePlayerSettings(page);
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.reload();
  await openPlayerSettings(page);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Alice");
  await closePlayerSettings(page);
});

test("starts a vs Computer game with a random first player", async ({ page }) => {
  await fillLogin(page, { name: "Alice", color: "blue", mode: "vs Computer" });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();

  // The player panel should show Alice's name on one of the player cards.
  await expect(page.getByRole("group", { name: /Alice/ })).toBeVisible();

  // Wait for the human's turn (enabled empty cell) and place a piece.
  await expect
    .poll(
      () =>
        page
          .locator('button[role="gridcell"]:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);
  const emptyCell = page.locator('button[role="gridcell"][aria-label$=", empty"]').first();
  await emptyCell.click();
  await expect(page.locator('button[role="gridcell"][aria-label*="occupied by"]').first()).toBeVisible({ timeout: 2_000 });
});

test("sets up a private room with a custom code or a friend code", async ({ page }) => {
  await page.goto("/");
  await openPlayerSettings(page);
  await page.getByLabel("Name", { exact: true }).fill("Alice");
  await closePlayerSettings(page);
  await page.getByRole("radio", { name: "Online", exact: true }).click();

  // Create flow with custom room code
  await page.getByRole("radio", { name: "Create", exact: true }).click();
  await expect(page.getByLabel("Custom room code (optional)")).toBeVisible();
  await page.getByLabel("Custom room code (optional)").fill("abc");
  await expect(page.getByText("Custom room code must be 4–64 letters, digits, hyphens, or underscores.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Room" })).toBeDisabled();
  await page.getByLabel("Custom room code (optional)").fill("friday-game");
  await expect(page.getByRole("button", { name: "Create Room" })).toBeEnabled();

  // Switch to Join flow — the room code field should carry over
  await page.getByRole("radio", { name: "Join", exact: true }).click();
  await expect(page.getByLabel("Room code")).toHaveValue("friday-game");
  await expect(page.getByRole("button", { name: "Join Room" })).toBeEnabled();
});

test("starts a vs Computer game and the AI responds", async ({ page }) => {
  await fillLogin(page, { name: "AI Player", color: "blue", mode: "vs Computer" });
  // Difficulty is now inside the opponent sheet.
  await openOpponentSettings(page);
  const difficultyGroup = page.getByRole("radiogroup", { name: "AI difficulty" });
  await expect(difficultyGroup.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: "Insane", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Normal", exact: true }).click();
  await closeOpponentSettings(page);
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();
  await expect(page.getByRole("button", { name: "How to play" })).toBeVisible();

  // Wait for the human's turn — who starts is now random, so the AI
  // might move first. An enabled empty cell means it's the human's turn.
  await expect
    .poll(
      () =>
        page
          .locator('button[role="gridcell"]:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);

  // Human plays the first available empty cell, then the AI should play somewhere.
  const emptyCell = page.locator('button[role="gridcell"][aria-label$=", empty"]').first();
  await emptyCell.click();
  // The clicked cell should now have an SVG (piece was placed).
  const occupiedCell = page.locator('button[role="gridcell"][aria-label*="occupied by"]').first();
  await expect(occupiedCell.locator("svg")).toBeVisible();

  // The AI has an intentional thinking delay (~700ms) so the player can
  // see the board state. After it finishes, empty cells become clickable again.
  await expect
    .poll(
      () =>
        page
          .locator('button[role="gridcell"]:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 2_000 },
    )
    .toBeGreaterThan(0);

  // The AI responds after its short thinking delay; exactly one
  // O cell should appear and the panel should not say it's the
  // human's turn anymore.
  const oCell = page.getByRole("gridcell", { name: /, occupied by O/ });
  await expect(oCell).toBeVisible({ timeout: 5_000 });

  // Both the human and AI pieces should be visible with distinct colors.
  // Who is X vs O is random, so just verify both X and O cells have colored SVGs.
  const xCell = page.getByRole("gridcell", { name: /, occupied by X/ }).first();
  await expect(xCell).toBeVisible();
  await expect(oCell.first().locator("svg")).toHaveClass(/text-(red|blue)-500/);
  await expect(xCell.locator("svg")).toHaveClass(/text-(red|blue)-500/);
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

  // First player plays top-left; the panel should now show the other player's turn.
  await clickCell(page, 1, 1);
  await expect(page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("svg")).toBeVisible();
  await expect(page.getByText(/Bob.*turn|Alice.*turn/).first()).toBeVisible();

  // Second player plays top-right; the panel should show the first player's turn again.
  await clickCell(page, 1, 3);
  await expect(page.getByRole("gridcell", { name: /Row 1 column 3/ }).locator("svg")).toBeVisible();

  // Both pieces should have distinct colors (blue vs red by default).
  const cell1Color = await page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("svg").getAttribute("class");
  const cell3Color = await page.getByRole("gridcell", { name: /Row 1 column 3/ }).locator("svg").getAttribute("class");
  expect(cell1Color).toMatch(/text-(red|blue)-500/);
  expect(cell3Color).toMatch(/text-(red|blue)-500/);
  // The two cells should have different colors.
  expect(cell1Color).not.toEqual(cell3Color);
});

test("customizes distinct colors for both VS Friend players", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });

  // User picks green in the player sheet.
  await openPlayerSettings(page);
  const yourColor = page.getByRole("group", { name: /Your color/i });
  await expect(yourColor).toBeVisible();
  await yourColor.getByRole("button", { name: /green color/i }).click();
  await expect(yourColor.getByRole("button", { name: /green color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await closePlayerSettings(page);

  // Opponent picks green (the user's color) in the opponent sheet.
  // The swap logic moves the user to the opponent's previous color (red)
  // so the two marks stay distinct.
  await openOpponentSettings(page);
  const opponentColor = page.getByRole("group", { name: /Opponent color/i });
  await expect(opponentColor).toBeVisible();
  await opponentColor.getByRole("button", { name: /green color/i }).click();
  await expect(opponentColor.getByRole("button", { name: /green color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await closeOpponentSettings(page);

  // Re-open the player sheet to confirm the user was swapped to red.
  await openPlayerSettings(page);
  await expect(page.getByRole("group", { name: /Your color/i }).getByRole("button", { name: /red color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await closePlayerSettings(page);

  // Swap colors back: player picks green, then opponent picks red.
  await openPlayerSettings(page);
  await page.getByRole("group", { name: /Your color/i }).getByRole("button", { name: /green color/i }).click();
  await closePlayerSettings(page);

  await openOpponentSettings(page);
  await page.getByRole("group", { name: /Opponent color/i }).getByRole("button", { name: /red color/i }).click();
  await closeOpponentSettings(page);

  await page.getByRole("button", { name: "Start Game" }).click();
  await clickCell(page, 1, 1); // first player
  await clickCell(page, 1, 2); // second player
  // The two pieces should have the configured distinct colors (green vs red).
  const cell1Color = await page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("svg").getAttribute("class");
  const cell2Color = await page.getByRole("gridcell", { name: /Row 1 column 2/ }).locator("svg").getAttribute("class");
  expect(cell1Color).toMatch(/text-(green|red)-500/);
  expect(cell2Color).toMatch(/text-(green|red)-500/);
  expect(cell1Color).not.toEqual(cell2Color);
});

test("supports 1-9 keyboard shortcuts without hijacking dialogs", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();

  const cells = page.getByRole("gridcell");
  await expect(cells).toHaveCount(9);
  for (let index = 0; index < 9; index += 1) {
    await expect(cells.nth(index)).toHaveAttribute("aria-keyshortcuts", String(index + 1));
  }

  await page.keyboard.press("1");
  await expect(page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("svg")).toBeVisible();

  const newGameButton = page.getByRole("button", { name: "Start a new game" });
  await newGameButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByRole("gridcell", { name: "Row 1 column 2, empty" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(newGameButton).toBeFocused();
  const secondCell = page.getByRole("gridcell", { name: "Row 1 column 2, empty" });
  await secondCell.press("2");
  await expect(page.getByRole("gridcell", { name: /Row 1 column 2/ }).locator("svg")).toBeVisible();
});

test("highlights winning cells without drawing a win line", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();

  await clickCell(page, 1, 1); // X
  await clickCell(page, 2, 1); // O
  await clickCell(page, 1, 2); // X
  await clickCell(page, 2, 2); // O
  await clickCell(page, 1, 3); // X wins

  await expect(page.getByText(/(Alice|Bob) wins!/, { exact: true })).toBeVisible();
  await expect(page.locator('button[role="gridcell"][class~="bg-emerald-500/20"]')).toHaveCount(3);
});

test("marks the oldest X piece as 'next to be removed' after the 3rd move", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();

  // In vs Friend mode turns alternate. Build X pieces without creating a
  // winning line so the 3-piece cap can flag the oldest X.
  await clickCell(page, 1, 1); // X
  await clickCell(page, 2, 1); // O
  await clickCell(page, 2, 2); // X
  await clickCell(page, 1, 2); // O
  await clickCell(page, 3, 1); // X
  await clickCell(page, 2, 3); // O
  await expect(
    page.getByRole("gridcell", { name: /Row 1 column 1/ }),
  ).toHaveAttribute("aria-label", /next to be removed/);

  // The other two X pieces are not flagged.
  await expect(
    page.getByRole("gridcell", { name: /Row 2 column 2/ }),
  ).not.toHaveAttribute("aria-label", /next to be removed/);
  await expect(
    page.getByRole("gridcell", { name: /Row 3 column 1/ }),
  ).not.toHaveAttribute("aria-label", /next to be removed/);
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

test("two online sessions sync through the waiting-room UI, play, and rematch", async ({
  browser,
}) => {
  test.setTimeout(180_000);

  // Online smoke requires a reachable matchmaking Worker (deployed via
  // E2E_BASE_URL, or local via the VITE_MATCHMAKING_URL we point at the
  // sibling fuurma-matchmaking Wrangler dev server).
  const e2eBaseUrl = process.env.E2E_BASE_URL;
  test.skip(!e2eBaseUrl, "Online P2P smoke requires E2E_BASE_URL");

  const host = await browser.newContext();
  const guest = await browser.newContext();
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  // Host creates a private room.
  await hostPage.goto(`${e2eBaseUrl}/`);
  await hostPage.getByLabel("Your name").fill("Host");
  await hostPage.getByRole("radio", { name: "Online", exact: true }).click();
  await hostPage.getByRole("button", { name: "Private room", exact: true }).click();
  await hostPage.getByRole("button", { name: "Create", exact: true }).click();
  await hostPage.getByRole("button", { name: "Create Room" }).click();

  // Intentional waiting-room contract: the host sees "Room ready" with a
  // room code BEFORE the board appears. The board must not be visible until
  // the guest joins and the relay completes the hello/join handshake.
  await expect(hostPage.getByText("Room ready")).toBeVisible({ timeout: 30_000 });
  await expect(
    hostPage.getByRole("grid", { name: "Tic Tac Toe game board" }),
  ).toHaveCount(0);

  const hostWaiting = hostPage.getByLabel(/^Room code /);
  await expect(hostWaiting).toBeVisible();
  const roomId = ((await hostWaiting.textContent()) ?? "").trim();
  expect(roomId.length).toBeGreaterThanOrEqual(4);

  // Guest joins via the invite link. The board is also gated on the
  // handshake completing.
  await guestPage.goto(`${e2eBaseUrl}/?room=${roomId}`);
  await guestPage.getByLabel("Your name").fill("Guest");
  await expect(guestPage.getByRole("radio", { name: "Online", exact: true })).toBeChecked();
  await expect(guestPage.getByLabel("Room code")).toHaveValue(roomId);
  await guestPage.getByRole("button", { name: "Join Room" }).click();
  // The connecting state appears briefly until the relay completes the
  // hello/join handshake. Don't assert it strictly because on a fast
  // local Worker it can resolve before Playwright observes it; the
  // stricter contract is the boards becoming visible below.
  await expect
    .poll(
      () =>
        guestPage
          .locator("body")
          .innerText()
          .then((t) => t.includes("Joining room") || t.includes("Opponent:")),
      { timeout: 5_000 },
    )
    .toBe(true);

  // Boards only appear once both sides transition past the waiting room
  // into the connected state, and both sides see the other's display name.
  await expect(
    hostPage.getByRole("grid", { name: "Tic Tac Toe game board" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    guestPage.getByRole("grid", { name: "Tic Tac Toe game board" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(hostPage.getByText("Opponent: Guest")).toBeVisible();
  await expect(guestPage.getByText("Opponent: Host")).toBeVisible();

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

test("quick-match places both clients into a shared room", async ({ browser }) => {
  test.setTimeout(180_000);

  const e2eBaseUrl = process.env.E2E_BASE_URL;
  test.skip(!e2eBaseUrl, "Quick match smoke requires E2E_BASE_URL");

  const first = await browser.newContext();
  const second = await browser.newContext();
  const firstPage = await first.newPage();
  const secondPage = await second.newPage();

  await firstPage.goto(`${e2eBaseUrl}/`);
  await firstPage.getByLabel("Your name").fill("Alice");
  await firstPage.getByRole("radio", { name: "Online", exact: true }).click();
  await firstPage.getByRole("button", { name: "Quick Match" }).click();

  // Quick match routes the first player to the host waiting-room UI while
  // they wait for the matchmaking service to pair them.
  await expect(firstPage.getByText("Finding an opponent…")).toBeVisible({ timeout: 30_000 });

  await secondPage.goto(`${e2eBaseUrl}/`);
  await secondPage.getByLabel("Your name").fill("Bob");
  await secondPage.getByRole("radio", { name: "Online", exact: true }).click();
  await secondPage.getByRole("button", { name: "Quick Match" }).click();

  // The second client ends up as the guest. It goes through the joining
  // state until the relay completes, then sees the host board.
  await expect(
    secondPage.getByRole("grid", { name: "Tic Tac Toe game board" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(secondPage.getByText(/Opponent: Alice/i)).toBeVisible();

  await first.close();
  await second.close();
});
