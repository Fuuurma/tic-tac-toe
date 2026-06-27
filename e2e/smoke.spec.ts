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

test("pairs two online players", async ({ browser }) => {
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

    await expect(playerOne.getByText("ONLINE")).toBeVisible();
    await expect(playerTwo.getByText("ONLINE")).toBeVisible();
    await expect(playerOne.getByRole("gridcell")).toHaveCount(9);
    await expect(playerTwo.getByRole("gridcell")).toHaveCount(9);
  } finally {
    await playerOneContext.close();
    await playerTwoContext.close();
  }
});
