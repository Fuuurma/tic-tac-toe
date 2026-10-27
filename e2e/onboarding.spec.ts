// Deliberately NOT the `./fixtures` test: these specs need a browser that has
// never seen the app, which is who onboarding is for.
import { expect, test, type Page } from "@playwright/test";

const WIN = "Three in a row. You win!";

const enabledEmptyCell = (page: Page) =>
  page.locator('button[aria-label*=", empty"]:not([disabled])').first();

/** Waits out the AI's reply: either the player may move again, or they have won. */
async function untilPlayersTurn(page: Page) {
  await page.getByText(WIN).or(enabledEmptyCell(page)).first().waitFor();
}

async function placeMark(page: Page) {
  await untilPlayersTurn(page);
  await enabledEmptyCell(page).click();
}

async function playToTheWin(page: Page) {
  for (let turn = 0; turn < 30; turn += 1) {
    await untilPlayersTurn(page);
    if (await page.getByText(WIN).isVisible()) return;
    const suggested = page.getByRole("button", { name: /suggested move/ });
    await ((await suggested.count()) > 0 ? suggested : enabledEmptyCell(page)).click();
  }
  throw new Error("the practice round never reached a win");
}

async function setUpPlayer(page: Page, name: string, color: string, symbol: string) {
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("radio", { name: color, exact: true }).click();
  await page.getByRole("radio", { name: symbol, exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("a new visitor builds their player, learns the vanish by playing, and lands ready", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your oldest mark vanishes." })).toBeVisible();

  await setUpPlayer(page, "Maria", "Pink", "Heart");
  await expect(page.getByRole("heading", { name: "Practice round" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Place your first mark");

  await placeMark(page);
  await placeMark(page);
  await placeMark(page);
  await untilPlayersTurn(page);
  await expect(page.getByRole("status")).toContainText("Your oldest mark is blinking");
  await expect(page.getByRole("button", { name: /occupied by Heart, next to be removed/ })).toHaveCount(1);

  await placeMark(page);
  await expect(page.getByRole("status")).toContainText("It vanished");
  // The player's own marks stay at three: the fourth cost them the oldest.
  await expect(page.getByRole("button", { name: /occupied by Heart/ })).toHaveCount(3);

  await playToTheWin(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "You're all set, Maria" })).toBeVisible();
  await page.getByRole("button", { name: "Start playing" }).click();

  // The lobby opens already wearing what they built.
  await expect(page.getByRole("button", { name: "Edit your player settings" })).toContainText("Maria");

  // And it never comes back.
  await page.reload();
  await expect(page.getByRole("button", { name: "Edit your player settings" })).toContainText("Maria");
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("skipping is respected straight away and remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /skip, i know how to play/i }).click();
  await expect(page.getByRole("radio", { name: "vs Computer", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("radio", { name: "vs Computer", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("leaving mid-tour keeps what was already chosen", async ({ page }) => {
  await page.goto("/");
  await setUpPlayer(page, "Maria", "Green", "Star");
  await placeMark(page);
  await page.getByRole("button", { name: "Skip" }).click();

  await expect(page.getByRole("button", { name: "Edit your player settings" })).toContainText("Maria");
});

test("a returning player never sees it", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tic-tac-toe:guestId", "guest:returning");
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Edit your player settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("an invited friend goes straight to their room", async ({ page }) => {
  await page.goto("/?room=friday-game");
  await expect(page.getByLabel(/^Room code/)).toHaveValue("friday-game");
  await expect(page.getByRole("button", { name: "Get started" })).toHaveCount(0);
});

test("the practice round can be replayed from Settings without touching the setup", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tic-tac-toe:guestId", "guest:returning");
    window.localStorage.setItem("tic-tac-toe:displayName", "Maria");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Replay tutorial" }).click();
  await expect(page.getByRole("heading", { name: "Practice round" })).toBeVisible();

  await playToTheWin(page);
  await page.getByRole("button", { name: "Back to lobby" }).click();
  await expect(page.getByRole("button", { name: "Edit your player settings" })).toContainText("Maria");
});

test.describe("on a small phone", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test("every step keeps its action and the whole board within reach", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Get started" })).toBeInViewport({ ratio: 1 });

    await page.getByRole("button", { name: "Get started" }).click();
    await expect(page.getByRole("button", { name: "Continue" })).toBeInViewport({ ratio: 1 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Row 1 column 1" })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Row 3 column 3" })).toBeInViewport({ ratio: 1 });
  });
});
