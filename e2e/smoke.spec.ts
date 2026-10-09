import { expect, test } from "@playwright/test";
import { onlineSmokeEnabled } from "./matchmaking";

async function openPlayerSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Edit your player settings" }).click();
}

// The settings sheet's dismiss button is named "Close" and the help drawer's
// is "Close help" — an unscoped getByRole name match is a substring hit on
// both, so whenever both dialogs render (the drawer once stayed mounted in
// the lobby) strict mode fails on two elements. Scope to the sheet.
async function closeSettingsSheet(page: import("@playwright/test").Page) {
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Close" })
    .click();
}

async function closePlayerSettings(page: import("@playwright/test").Page) {
  await closeSettingsSheet(page);
}

async function openOpponentSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Edit opponent settings" }).click();
}

async function closeOpponentSettings(page: import("@playwright/test").Page) {
  await closeSettingsSheet(page);
}

async function fillLobby(
  page: import("@playwright/test").Page,
  options: {
    name: string;
    color: string;
    mode: "vs Computer" | "vs Friend" | "Online";
    opponentName?: string;
    onlineAction?: "Create" | "Join" | "Quick";
    roomId?: string;
    startUrl?: string;
  },
) {
  await page.goto(options.startUrl ?? "/");
  await page.getByRole("radio", { name: options.mode, exact: true }).click();
  if (options.opponentName && options.mode === "vs Friend") {
    await openOpponentSettings(page);
    await page.getByLabel("Opponent name", { exact: true }).fill(options.opponentName);
    await closeOpponentSettings(page);
  }
  if (options.mode === "Online") {
    const action = options.onlineAction ?? "Create";
    await page.getByRole("radio", { name: action, exact: true }).click();
    if (action === "Join" && options.roomId) {
      await page.getByLabel("Room code").fill(options.roomId);
    }
  }
  // Fill the player name inside the settings sheet.
  await openPlayerSettings(page);
  await page.getByLabel("Your name", { exact: true }).fill(options.name);
  await closePlayerSettings(page);
}

async function clickCell(
  page: import("@playwright/test").Page,
  row: 1 | 2 | 3,
  col: 1 | 2 | 3,
) {
  await page.getByRole("button", { name: `Row ${row} column ${col}` }).click();
}

async function playOnlineCell(
  hostPage: import("@playwright/test").Page,
  guestPage: import("@playwright/test").Page,
  row: 1 | 2 | 3,
  col: 1 | 2 | 3,
) {
  const cellName = `Row ${row} column ${col}, empty`;
  const hostCell = hostPage.getByRole("button", { name: cellName });
  const guestCell = guestPage.getByRole("button", { name: cellName });

  await expect
    .poll(
      async () => (await hostCell.isEnabled()) || (await guestCell.isEnabled()),
      { timeout: 10_000 },
    )
    .toBe(true);

  if (await hostCell.isEnabled()) {
    await hostCell.click();
  } else {
    await guestCell.click();
  }
}

test("loads the playable shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Tic Tac Toe Disappear/);
  await expect(page.getByRole("heading", { name: "Tic Tac Toe Disappear", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit your player settings" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "vs Computer", exact: true })).toBeVisible();
});

test("settings tablist follows the Arrow/Home/End keyboard contract", async ({ page }) => {
  await page.goto("/");
  await openPlayerSettings(page);
  const youTab = page.getByRole("tab", { name: "You" });
  const aiTab = page.getByRole("tab", { name: "AI" });
  await expect(youTab).toHaveAttribute("aria-selected", "true");
  await youTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(aiTab).toHaveAttribute("aria-selected", "true");
  await expect(aiTab).toBeFocused();
  await page.keyboard.press("Home");
  await expect(youTab).toHaveAttribute("aria-selected", "true");
  await expect(youTab).toBeFocused();
  await page.keyboard.press("End");
  await expect(aiTab).toHaveAttribute("aria-selected", "true");
  await expect(aiTab).toBeFocused();
  await closePlayerSettings(page);
});

test("remembers the display name after starting a game", async ({ page }) => {
  await page.goto("/");
  await openPlayerSettings(page);
  await page.getByLabel("Your name", { exact: true }).fill("Alice");
  await closePlayerSettings(page);
  await page.getByRole("button", { name: "Start Game" }).click();
  await page.reload();
  await openPlayerSettings(page);
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Alice");
  await closePlayerSettings(page);
});

test("starts a vs Computer game with a random first player", async ({ page }) => {
  await fillLobby(page, { name: "Alice", color: "blue", mode: "vs Computer" });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("group", { name: "Tic Tac Toe game board" })).toBeVisible();

  // The player panel should show Alice's name on one of the player cards.
  await expect(page.getByRole("group", { name: /Alice/ })).toBeVisible();

  // Wait for the human's turn (enabled empty cell) and place a piece.
  await expect
    .poll(
      () =>
        page
          .locator('button:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);
  const emptyCell = page.locator('button[aria-label$=", empty"]').first();
  await emptyCell.click();
  await expect(page.locator('button[aria-label*="occupied by"]').first()).toBeVisible({ timeout: 2_000 });
});

test("the computer plays on its own turn, including the opening one", async ({ page }) => {
  await fillLobby(page, { name: "Race Player", color: "blue", mode: "vs Computer" });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("group", { name: "Tic Tac Toe game board" })).toBeVisible();

  // Whoever was dealt the first move, the game must advance by itself.
  // The computer's opening move is the regression this pins: its setTimeout
  // lands in the same batch as the turn clock's first tick, and the commit
  // used to be dropped, leaving the AI to sit there until the 10s timeout.
  const computerOpens = await page.evaluate(() =>
    [...document.querySelectorAll("[role=group]")].some((group) =>
      /^AI,/.test(group.getAttribute("aria-label") ?? "") &&
      /current turn/i.test(group.getAttribute("aria-label") ?? ""),
    ),
  );

  if (!computerOpens) {
    await page.locator('button[aria-label$=", empty"]').first().click();
  }

  // A piece on the board proves the move landed, well inside the turn clock.
  await expect(page.locator('button[aria-label*="occupied by"]').first()).toBeVisible({
    timeout: 3_000,
  });
  await expect(page.getByText(/ran out of time/i)).toHaveCount(0);
});

test("record breakdown breaks the record down by mode and difficulty", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tic-tac-toe:guestId", "guest:e2e-record");
    window.localStorage.setItem(
      "tic-tac-toe:stats:guest:e2e-record",
      JSON.stringify({
        totalGames: 7,
        wins: 5,
        losses: 2,
        currentWinStreak: 1,
        bestWinStreak: 3,
        breakdown: {
          "VS_COMPUTER:HARD": { wins: 4, losses: 2 },
          VS_FRIEND: { wins: 1, losses: 0 },
        },
      }),
    );
  });
  await fillLobby(page, { name: "Record Player", color: "blue", mode: "vs Computer" });
  await page.getByRole("button", { name: "Start Game" }).click();

  const trigger = page.getByRole("button", { name: "Show record breakdown" });
  await expect(trigger).toBeVisible();
  await expect(page.getByRole("group", { name: /record by mode/i })).toHaveCount(0);

  // Click opens it (the touch path); the panel sits above the player cards.
  await trigger.click();
  const panel = page.getByRole("group", { name: /record by mode/i });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Easy");
  await expect(panel).toContainText("Normal");
  await expect(panel).toContainText("Hard");
  await expect(panel).toContainText("4W");
  await expect(panel).toContainText("2L");
  await expect(panel).toContainText("vs Friend");

  // Clicking unpins it, but the pointer is still over the trigger, so it
  // stays up on hover until the pointer leaves.
  await trigger.click();
  await page.mouse.move(5, 5);
  await expect(page.getByRole("group", { name: /record by mode/i })).toHaveCount(0);
});

test("sets up a private room with a custom code or a friend code", async ({ page }) => {
  await page.goto("/");
  await openPlayerSettings(page);
  await page.getByLabel("Your name", { exact: true }).fill("Alice");
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
  await fillLobby(page, { name: "AI Player", color: "blue", mode: "vs Computer" });
  // Difficulty is now inside the opponent sheet, behind a dropdown trigger.
  await openOpponentSettings(page);
  await page.getByRole("button", { name: /Difficulty/ }).click();
  const difficultyGroup = page.getByRole("radiogroup", { name: "AI difficulty" });
  await expect(difficultyGroup.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radio", { name: "Insane", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Normal", exact: true }).click();
  await closeOpponentSettings(page);
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("group", { name: "Tic Tac Toe game board" })).toBeVisible();
  await expect(page.getByRole("button", { name: "How to play" })).toBeVisible();

  // Wait for the human's turn — who starts is now random, so the AI
  // might move first. An enabled empty cell means it's the human's turn.
  await expect
    .poll(
      () =>
        page
          .locator('button:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 5_000 },
    )
    .toBeGreaterThan(0);

  // Human plays the first available empty cell, then the AI should play somewhere.
  const emptyCell = page.locator('button[aria-label$=", empty"]').first();
  const pieces = page.locator('button[aria-label*="occupied by"]');
  // Sample before the click: whoever opened, the reply cycle adds exactly
  // two pieces (this move and the AI's). Reading the count after the click
  // races the AI's ~700ms timer.
  const beforePlay = await pieces.count();
  await emptyCell.click();
  // The clicked cell should now have an SVG (piece was placed).
  await expect(pieces.first().locator("svg")).toBeVisible();

  // The AI has an intentional thinking delay (~700ms) so the player can
  // see the board state. It answers by placing a piece.
  await expect
    .poll(() => pieces.count(), { timeout: 5_000 })
    .toBe(beforePlay + 2);

  // Both pieces render, and the turn is back with the human.
  await expect(pieces.first().locator("svg")).toHaveClass(/text-(red|blue)-500/);
  await expect(pieces.last().locator("svg")).toHaveClass(/text-(red|blue)-500/);
  await expect
    .poll(
      () =>
        page
          .locator('button:not(:disabled)')
          .evaluateAll((cells) =>
            cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
          ),
      { timeout: 2_000 },
    )
    .toBeGreaterThan(0);
});

test("starts a vs Friend game and the turn alternates", async ({ page }) => {
  await fillLobby(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("group", { name: "Tic Tac Toe game board" })).toBeVisible();

  // First player plays top-left; the panel should now show the other player's turn.
  await clickCell(page, 1, 1);
  await expect(page.getByRole("button", { name: /Row 1 column 1/ }).locator("svg")).toBeVisible();
  await expect(page.getByText(/Bob.*turn|Alice.*turn/).first()).toBeVisible();

  // Second player plays top-right; the panel should show the first player's turn again.
  await clickCell(page, 1, 3);
  await expect(page.getByRole("button", { name: /Row 1 column 3/ }).locator("svg")).toBeVisible();

  // Both pieces should have distinct colors (blue vs red by default).
  const cell1Color = await page.getByRole("button", { name: /Row 1 column 1/ }).locator("svg").getAttribute("class");
  const cell3Color = await page.getByRole("button", { name: /Row 1 column 3/ }).locator("svg").getAttribute("class");
  expect(cell1Color).toMatch(/text-(red|blue)-500/);
  expect(cell3Color).toMatch(/text-(red|blue)-500/);
  // The two cells should have different colors.
  expect(cell1Color).not.toEqual(cell3Color);
});

test("customizes distinct colors for both VS Friend players", async ({ page }) => {
  await fillLobby(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });

  // User picks green in the player sheet — the color options live behind
  // the "Your color" dropdown trigger.
  await openPlayerSettings(page);
  await page.getByRole("button", { name: "Your color" }).click();
  const yourColor = page.getByRole("radiogroup", { name: "Your color" });
  await expect(yourColor).toBeVisible();
  await yourColor.getByRole("radio", { name: /green/i }).click();
  await expect(yourColor.getByRole("radio", { name: /green/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await closePlayerSettings(page);

  // Opponent picks green (the user's color) in the opponent sheet.
  // The swap logic moves the user to the opponent's previous color (red)
  // so the two marks stay distinct.
  await openOpponentSettings(page);
  await page.getByRole("button", { name: "Opponent color" }).click();
  const opponentColor = page.getByRole("radiogroup", { name: "Opponent color" });
  await expect(opponentColor).toBeVisible();
  await opponentColor.getByRole("radio", { name: /green/i }).click();
  await expect(opponentColor.getByRole("radio", { name: /green/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await closeOpponentSettings(page);

  // Re-open the player sheet to confirm the user was swapped to red.
  await openPlayerSettings(page);
  await page.getByRole("button", { name: "Your color" }).click();
  await expect(page.getByRole("radiogroup", { name: "Your color" }).getByRole("radio", { name: /red/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await closePlayerSettings(page);

  // Swap colors back: player picks green, then opponent picks red.
  await openPlayerSettings(page);
  await page.getByRole("button", { name: "Your color" }).click();
  await page.getByRole("radiogroup", { name: "Your color" }).getByRole("radio", { name: /green/i }).click();
  await closePlayerSettings(page);

  await openOpponentSettings(page);
  await page.getByRole("button", { name: "Opponent color" }).click();
  await page.getByRole("radiogroup", { name: "Opponent color" }).getByRole("radio", { name: /red/i }).click();
  await closeOpponentSettings(page);

  await page.getByRole("button", { name: "Start Game" }).click();
  await clickCell(page, 1, 1); // first player
  await clickCell(page, 1, 2); // second player
  // The two pieces should have the configured distinct colors (green vs red).
  const cell1Color = await page.getByRole("button", { name: /Row 1 column 1/ }).locator("svg").getAttribute("class");
  const cell2Color = await page.getByRole("button", { name: /Row 1 column 2/ }).locator("svg").getAttribute("class");
  expect(cell1Color).toMatch(/text-(green|red)-500/);
  expect(cell2Color).toMatch(/text-(green|red)-500/);
  expect(cell1Color).not.toEqual(cell2Color);
});

test("supports 1-9 keyboard shortcuts without hijacking dialogs", async ({ page }) => {
  await fillLobby(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();

  const cells = page.getByRole("group", { name: "Tic Tac Toe game board" }).getByRole("button");
  await expect(cells).toHaveCount(9);
  for (let index = 0; index < 9; index += 1) {
    await expect(cells.nth(index)).toHaveAttribute("aria-keyshortcuts", String(index + 1));
  }

  await page.keyboard.press("1");
  await expect(page.getByRole("button", { name: /Row 1 column 1/ }).locator("svg")).toBeVisible();

  const newGameButton = page.getByRole("button", { name: "Start a new game" });
  await newGameButton.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: "Row 1 column 2, empty" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(newGameButton).toBeFocused();
  await page.keyboard.press("2");
  await expect(page.getByRole("button", { name: /Row 1 column 2/ }).locator("svg")).toBeVisible();
});

test("highlights the three winning cells", async ({ page }) => {
  await fillLobby(page, {
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
  await expect(page.locator('button[class~="bg-emerald-500/20"]')).toHaveCount(3);
});

test("marks the oldest X piece as 'next to be removed' after the 3rd move", async ({ page }) => {
  await fillLobby(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("group", { name: "Tic Tac Toe game board" })).toBeVisible();

  // In vs Friend mode turns alternate. Build X pieces without creating a
  // winning line so the 3-piece cap can flag the oldest X.
  await clickCell(page, 1, 1); // X
  await clickCell(page, 2, 1); // O
  await clickCell(page, 2, 2); // X
  await clickCell(page, 1, 2); // O
  await clickCell(page, 3, 1); // X
  await clickCell(page, 2, 3); // O
  await expect(
    page.getByRole("button", { name: /Row 1 column 1/ }),
  ).toHaveAttribute("aria-label", /next to be removed/);

  // The other two X pieces are not flagged.
  await expect(
    page.getByRole("button", { name: /Row 2 column 2/ }),
  ).not.toHaveAttribute("aria-label", /next to be removed/);
  await expect(
    page.getByRole("button", { name: /Row 3 column 1/ }),
  ).not.toHaveAttribute("aria-label", /next to be removed/);
});

test("play again after a local win resets the board", async ({ page }) => {
  await fillLobby(page, {
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

  // Post-win reset is immediate (the confirm dialog is mid-game only).
  await page.getByRole("button", { name: "Play again" }).click();

  await expect(page.getByText(/(Alice|Bob) wins!/)).toBeHidden();
  await expect(page.getByRole("button", { name: /occupied/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Row 1 column 1, empty" }),
  ).toBeVisible();
});

test("exiting before the first move exits instead of freezing the board", async ({
  page,
}) => {
  await fillLobby(page, {
    name: "Alice",
    color: "blue",
    mode: "vs Friend",
    opponentName: "Bob",
  });
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(
    page.getByRole("button", { name: "Row 1 column 1, empty" }),
  ).toBeVisible();

  // No moves yet, so there is nothing to confirm. The panel suppresses the
  // dialog for a fresh game; if it also armed the pause, only the dialog could
  // disarm it, stranding the board disabled with no visible pause state.
  await page.getByRole("button", { name: "Exit game" }).click();

  await expect(page.getByRole("button", { name: "Start Game" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Row 1 column 1, empty" }),
  ).toHaveCount(0);
});

// Pausing must freeze BOTH the numeric countdown and the CSS ring. The ring
// is an animation keyed to the turn, so it used to keep draining while the
// number stood still — the two disagreed for the rest of the turn.
test("pausing freezes the countdown and the ring", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "vs Friend", exact: true }).click();
  await page.getByRole("button", { name: "Edit opponent settings" }).click();
  await page.getByLabel("Opponent name", { exact: true }).fill("Bob");
  await closeSettingsSheet(page);
  await page.getByRole("button", { name: "Start Game" }).click();

  const ring = page.locator("path.animate-countdown-border");
  const timer = page.getByRole("timer");
  await expect(ring).toBeVisible();

  const playState = () =>
    ring.evaluate((el) => getComputedStyle(el).animationPlayState);
  const seconds = () => timer.getAttribute("aria-label");

  expect(await playState()).toBe("running");
  const beforePause = await seconds();

  // Open the in-game settings sheet — this pauses the clock. Poll rather
  // than assert once: the sheet opening, the React effect, and the ring's
  // recomputed style are separate commits, so a bare read races the render.
  await page.getByRole("button", { name: "Edit player settings" }).click();

  await expect.poll(playState).toBe("paused");
  await expect
    .poll(async () => {
      const value = await seconds();
      // Hold until two reads a second apart agree: the number must not be
      // draining while the ring is frozen.
      await page.waitForTimeout(1200);
      return value === (await seconds()) ? value : "still-ticking";
    })
    .not.toBe("still-ticking");

  const atPause = await seconds();
  expect(atPause).toBe(beforePause);

  // Closing resumes: the ring runs again and the number moves on.
  await closeSettingsSheet(page);
  await expect.poll(playState).toBe("running");
  await page.waitForTimeout(1500);
  expect(await seconds()).not.toBe(atPause);
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
  // sibling fuurma-matchmaking Wrangler dev server). Same reachability
  // gate as quick-match — CI runs the sibling worker so this executes.
  test.skip(!(await onlineSmokeEnabled()), "Online P2P smoke requires E2E_BASE_URL or a reachable matchmaking Worker");

  const host = await browser.newContext();
  const guest = await browser.newContext();
  // Exercise the randomized host=O branch deterministically. The game must
  // still identify the host correctly while X remains the first mover.
  await host.addInitScript(() => {
    Math.random = () => 0.75;
  });
  const hostPage = await host.newPage();
  const guestPage = await guest.newPage();

  // Host creates a private room.
  await fillLobby(hostPage, {
    name: "Host",
    color: "blue",
    mode: "Online",
    onlineAction: "Create",
  });
  await hostPage.getByRole("button", { name: "Create Room" }).click();

  // Intentional waiting-room contract: the host sees "Room ready" with a
  // room code BEFORE the board appears. The board must not be visible until
  // the guest joins and the relay completes the hello/join handshake.
  await expect(hostPage.getByText("Room ready")).toBeVisible({ timeout: 30_000 });
  await expect(
    hostPage.getByRole("group", { name: "Tic Tac Toe game board" }),
  ).toHaveCount(0);

  const hostWaiting = hostPage.getByText(/^Room code \S+/);
  await expect(hostWaiting).toBeVisible();
  const roomId = ((await hostWaiting.textContent()) ?? "")
    .replace(/^Room code\s+/, "")
    .trim();
  expect(roomId.length).toBeGreaterThanOrEqual(4);

  // Guest joins via the invite link. The board is also gated on the
  // handshake completing.
  await fillLobby(guestPage, {
    name: "Guest",
    color: "red",
    mode: "Online",
    onlineAction: "Join",
    roomId,
    startUrl: `/?room=${roomId}`,
  });
  await expect(guestPage.getByLabel("Room code")).toHaveValue(roomId);
  await guestPage.getByRole("button", { name: "Join Room" }).click();
  // The connecting state appears briefly until the relay completes the
  // hello/join handshake. Don't assert it strictly because on a fast
  // local Worker it can resolve before Playwright observes it; the
  // stricter contract is the boards becoming visible below.
  await expect(
    guestPage
      .getByText(/Joining room/)
      .or(guestPage.getByRole("group", { name: "Tic Tac Toe game board" })),
  ).toBeVisible({ timeout: 5_000 });

  // Boards only appear once both sides transition past the waiting room
  // into the connected state, and both sides see the other's display name.
  await expect(
    hostPage.getByRole("group", { name: "Tic Tac Toe game board" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(
    guestPage.getByRole("group", { name: "Tic Tac Toe game board" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(hostPage.getByRole("group", { name: /^Guest,/ })).toBeVisible();
  await expect(guestPage.getByRole("group", { name: /^Host,/ })).toBeVisible();

  // The host's symbol is randomized, so follow whichever browser currently
  // owns the turn. Select fillers around the winning top-row moves so the
  // host wins whether it receives X (first) or O (second).
  const hostStarts = await hostPage
    .getByRole("button", { name: "Row 1 column 1, empty" })
    .isEnabled();
  const winningSequence: Array<[1 | 2 | 3, 1 | 2 | 3]> = hostStarts
    ? [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
        [1, 3],
      ]
    : [
        [2, 1],
        [1, 1],
        [2, 2],
        [1, 2],
        [3, 1],
        [1, 3],
      ];
  for (const [row, col] of winningSequence) {
    await playOnlineCell(hostPage, guestPage, row, col);
  }

  // Both clients see the host win regardless of the randomized symbol.
  await expect(hostPage.getByText(/Host wins/i)).toBeVisible({ timeout: 10_000 });
  await expect(guestPage.getByText(/Host wins/i)).toBeVisible({ timeout: 10_000 });

  // Either side may ask for another game, so both get the same controls.
  await expect(guestPage.getByRole("button", { name: "Play again" })).toBeVisible();
  await expect(hostPage.getByRole("button", { name: "Play again" })).toBeVisible();

  // Rematch: the guest asks, and the host is the one prompted. Reversing
  // the direction used to be impossible.
  await guestPage.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(hostPage.getByText(/Guest.*wants a rematch/i)).toBeVisible();
  await expect(guestPage.getByText(/Waiting for opponent/i)).toBeVisible();
  await hostPage.getByRole("button", { name: "Accept rematch" }).click();

  // Board is reset for BOTH sides - the winner text is gone and the timer
  // is back.
  await expect(hostPage.getByText(/Host wins/i)).toBeHidden({ timeout: 10_000 });
  await expect(guestPage.getByText(/Host wins/i)).toBeHidden({ timeout: 10_000 });
  await expect(hostPage.getByRole("timer")).toBeVisible();
  await expect(guestPage.getByRole("timer")).toBeVisible();

  // The second game is live: no winner yet, the clock runs, and somebody
  // has the move. Only the side on turn has enabled cells, so the move is
  // counted across both boards.
  const enabledOn = (view: typeof hostPage) =>
    view
      .locator('button:not(:disabled)')
      .evaluateAll(
        (cells) =>
          cells.filter((cell) => cell.getAttribute("aria-label")?.endsWith(", empty")).length,
      );
  await expect
    .poll(async () => (await enabledOn(hostPage)) + (await enabledOn(guestPage)), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  await host.close();
  await guest.close();
});

test("quick-match places both clients into a shared room", async ({ browser }) => {
  test.setTimeout(180_000);

  test.skip(
    !(await onlineSmokeEnabled()),
    "Quick match smoke requires E2E_BASE_URL or a reachable matchmaking Worker",
  );

  const first = await browser.newContext();
  const second = await browser.newContext();
  await first.addInitScript(() => {
    Math.random = () => 0.25;
  });
  const firstPage = await first.newPage();
  const secondPage = await second.newPage();

  await fillLobby(firstPage, {
    name: "Alice",
    color: "blue",
    mode: "Online",
    onlineAction: "Quick",
  });
  await firstPage.getByRole("button", { name: "Quick Match" }).click();

  // Quick match routes the first player to the host waiting-room UI while
  // they wait for the matchmaking service to pair them.
  await expect(firstPage.getByText(/Finding an opponent…|Room ready/)).toBeVisible({
    timeout: 30_000,
  });

  await fillLobby(secondPage, {
    name: "Bob",
    color: "red",
    mode: "Online",
    onlineAction: "Quick",
  });
  await secondPage.getByRole("button", { name: "Quick Match" }).click();

  // The second client ends up as the guest. It goes through the joining
  // state until the relay completes, then sees the host board.
  await expect(
    secondPage.getByRole("group", { name: "Tic Tac Toe game board" }),
  ).toBeVisible({ timeout: 90_000 });
  await expect(secondPage.getByRole("group", { name: /^Alice,/i })).toBeVisible();

  await first.close();
  await second.close();
});
