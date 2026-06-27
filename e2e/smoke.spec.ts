import { expect, test } from "@playwright/test";

async function chooseMode(page: import("@playwright/test").Page, mode: string) {
  await page.getByText(mode, { exact: true }).click();
}

async function startNamedGame(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();
}

test("loads the playable shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Tic Tac Toe/);
  await expect(page.getByText("Tic Tac Toe", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Game Mode")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play as Guest" })).toBeVisible();
});

test("starts an AI game", async ({ page }) => {
  await page.goto("/");

  await startNamedGame(page, "Smoke AI");

  await expect(page.getByRole("heading", { name: "VS COMPUTER" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(9);
});

test("starts a local two-player game", async ({ page }) => {
  await page.goto("/");

  await chooseMode(page, "Local Multiplayer");
  await page.getByLabel("Your name").fill("Smoke X");
  await page.getByLabel("Opponent's name").fill("Smoke O");
  await page.getByRole("button", { name: "Start Game" }).click();

  await expect(page.getByText("VS FRIEND")).toBeVisible();
  await expect(page.getByRole("grid", { name: "Tic Tac Toe game board" })).toBeVisible();
  await expect(page.getByRole("gridcell")).toHaveCount(9);
});

async function playOnlineMove(
  page: import("@playwright/test").Page,
  cellIndex: number,
) {
  await page.getByRole("gridcell").nth(cellIndex).click();
}

async function expectCellOccupied(
  pages: import("@playwright/test").Page[],
  cellIndex: number,
  symbol: "X" | "O",
  timeout = 10_000,
) {
  await Promise.all(
    pages.map((page) =>
      expect(page.getByRole("gridcell").nth(cellIndex)).toHaveAccessibleName(
        new RegExp(`occupied by ${symbol}`, "i"),
        { timeout },
      ),
    ),
  );
}

async function playMoveFromEitherPage(
  pages: import("@playwright/test").Page[],
  cellIndex: number,
  symbol: "X" | "O",
) {
  for (const page of pages) {
    await playOnlineMove(page, cellIndex);
    try {
      await expectCellOccupied(pages, cellIndex, symbol, 1_500);
      return;
    } catch {
      // Try the other tab; only the active player's client can make this move.
    }
  }

  await expectCellOccupied(pages, cellIndex, symbol);
}

test("pairs two online players, completes a match, and rematches", async ({ browser }) => {
  const playerOneContext = await browser.newContext();
  const playerTwoContext = await browser.newContext();
  const playerOne = await playerOneContext.newPage();
  const playerTwo = await playerTwoContext.newPage();

  try {
    await playerOne.goto("/");
    await playerTwo.goto("/");

    await chooseMode(playerOne, "Online Multiplayer");
    await chooseMode(playerTwo, "Online Multiplayer");

    await playerOne.getByLabel("Your name").fill("Online X");
    await playerTwo.getByLabel("Your name").fill("Online O");

    await playerOne.getByRole("button", { name: "Start Game" }).click();
    await expect(playerOne.getByText("Waiting for Opponent")).toBeVisible();

    await playerTwo.getByRole("button", { name: "Start Game" }).click();

    await expect(playerOne.getByRole("heading", { name: "ONLINE" })).toBeVisible();
    await expect(playerTwo.getByRole("heading", { name: "ONLINE" })).toBeVisible();
    await expect(playerOne.getByRole("gridcell")).toHaveCount(9);
    await expect(playerTwo.getByRole("gridcell")).toHaveCount(9);

    const pages = [playerOne, playerTwo];
    await playMoveFromEitherPage(pages, 0, "X");
    await playMoveFromEitherPage(pages, 3, "O");
    await playMoveFromEitherPage(pages, 1, "X");
    await playMoveFromEitherPage(pages, 4, "O");
    await playMoveFromEitherPage(pages, 2, "X");

    await expect(playerOne.getByText(/wins!/i)).toBeVisible();
    await expect(playerTwo.getByText(/wins!/i)).toBeVisible();

    await playerOne.getByRole("button", { name: "Request Rematch" }).click();
    await expect(playerTwo.getByRole("button", { name: "Accept Rematch" })).toBeVisible();
    await playerTwo.getByRole("button", { name: "Accept Rematch" }).click();

    await expect(playerOne.getByRole("gridcell").first()).toHaveAccessibleName(/empty/i);
    await expect(playerTwo.getByRole("gridcell").first()).toHaveAccessibleName(/empty/i);
  } finally {
    await playerOneContext.close();
    await playerTwoContext.close();
  }
});
