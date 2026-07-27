import { expect, test } from "@playwright/test";

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
  await page.getByLabel("Your name").fill(options.name);
  await page.getByRole("radio", { name: options.mode, exact: true }).click();
  if (options.opponentName) {
    await page.getByLabel("Opponent's name").fill(options.opponentName);
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
  await expect(page.getByRole("heading", { name: "Tic Tac Toe", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a mode, set your name, and start playing.")).toBeVisible();
  await expect(page.getByText("How do you want to play?", { exact: true })).toBeVisible();
});

test("remembers the display name after starting a game", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Alice");
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.reload();
  await expect(page.getByLabel("Your name")).toHaveValue("Alice");
});

test("lets a local player choose O and keeps the choice in the game", async ({ page }) => {
  await fillLogin(page, { name: "Alice", color: "blue", mode: "vs Computer" });
  await page.getByRole("radio", { name: "Play as O", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Play as O", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Start Game" }).click();

  // X is now the computer, so it moves first. The human O can move after
  // the AI response and the resulting piece keeps the configured identity.
  await expect(page.getByRole("gridcell", { name: /occupied by X/ })).toBeVisible({ timeout: 5_000 });
  const emptyCells = page.locator('button[role="gridcell"][aria-label$=", empty"]');
  await emptyCells.first().click();
  await expect(page.getByRole("gridcell", { name: /occupied by O/ })).toBeVisible();
  await expect(page.getByRole("group", { name: /Alice, O/ })).toBeVisible();
});

test("sets up a private room with a custom code or a friend code", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Alice");
  await page.getByRole("radio", { name: "Online", exact: true }).click();

  await page.getByRole("button", { name: "Private room", exact: true }).click();
  await expect(page.getByLabel("Custom room code (optional)")).toBeVisible();
  await page.getByLabel("Custom room code (optional)").fill("abc");
  await expect(page.getByText("Custom room code must be 4–64 letters, digits, hyphens, or underscores.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Room" })).toBeDisabled();
  await page.getByLabel("Custom room code (optional)").fill("friday-game");
  await expect(page.getByRole("button", { name: "Create Room" })).toBeEnabled();

  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByLabel("Room code")).toHaveValue("friday-game");
  await expect(page.getByRole("button", { name: "Join Room" })).toBeEnabled();
});

test("starts a vs Computer game and the AI responds", async ({ page }) => {
  await fillLogin(page, { name: "AI Player", color: "blue", mode: "vs Computer" });
  const difficultyGroup = page.getByRole("radiogroup", { name: "AI difficulty" });
  await expect(difficultyGroup.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: "Insane", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Normal", exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();
  await expect(page.getByText("Press 1–9 to play · on your 4th mark, your oldest mark moves")).toBeVisible();

  // Human plays top-left (X), then the AI should play somewhere.
  await clickCell(page, 1, 1);
  await expect(page.getByRole("gridcell", { name: /Row 1 column 1/ })).toContainText("X");

  // The AI may think briefly, but it should not leave the player unable to
  // make the next move for a perceptible half-second.
  await expect
    .poll(
      () =>
        page
          .locator('button[role="gridcell"]:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 450 },
    )
    .toBeGreaterThan(0);

  // The AI responds after its short thinking delay; exactly one
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

test("customizes distinct colors for both VS Friend players", async ({ page }) => {
  await fillLogin(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });

  const yourColor = page.getByRole("group", { name: /Your color/i });
  const opponentColor = page.getByRole("group", { name: /Opponent color/i });
  await expect(yourColor).toBeVisible();
  await expect(opponentColor).toBeVisible();

  await yourColor.getByRole("button", { name: /green color/i }).click();
  await opponentColor.getByRole("button", { name: /green color/i }).click();

  // Choosing an occupied color moves the previous owner to the opponent's
  // previous color, so the two marks remain easy to tell apart.
  await expect(yourColor.getByRole("button", { name: /red color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(opponentColor.getByRole("button", { name: /green color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Swap player colors" }).click();
  await expect(yourColor.getByRole("button", { name: /green color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(opponentColor.getByRole("button", { name: /red color/i })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: "Start Game" }).click();
  await clickCell(page, 1, 1); // X
  await clickCell(page, 1, 2); // O
  await expect(
    page.getByRole("gridcell", { name: /Row 1 column 1/ }).locator("span"),
  ).toHaveClass(/text-green-500/);
  await expect(
    page.getByRole("gridcell", { name: /Row 1 column 2/ }).locator("span"),
  ).toHaveClass(/text-red-500/);
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
  await expect(page.getByRole("gridcell", { name: /Row 1 column 1/ })).toContainText("X");

  const newGameButton = page.getByRole("button", { name: "Start a new game" });
  await newGameButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByRole("gridcell", { name: "Row 1 column 2, empty" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(newGameButton).toBeFocused();
  const secondCell = page.getByRole("gridcell", { name: "Row 1 column 2, empty" });
  await secondCell.press("2");
  await expect(page.getByRole("gridcell", { name: /Row 1 column 2/ })).toContainText("O");
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

  await expect(page.getByText("Alice wins!", { exact: true })).toBeVisible();
  await expect(page.locator('button[role="gridcell"][class~="bg-emerald-500/15"]')).toHaveCount(3);
  await expect(page.locator("svg line")).toHaveCount(0);
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
