import { expect, test } from "@playwright/test";

test("PlayersPanel actions stay with the board on desktop and below it on phones", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("tic-tac-toe:displayName", "Alice");
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("radio", { name: "vs Friend", exact: true }).click();
  await page.getByRole("button", { name: "Start Game", exact: true }).click();

  const board = page.getByRole("group", { name: "Tic Tac Toe game board" });
  const exit = page.getByRole("button", { name: "Exit game", exact: true });
  await expect(board).toBeVisible();
  await expect(exit).toBeVisible();

  const desktopBoard = await board.boundingBox();
  const desktopExit = await exit.boundingBox();
  expect(desktopBoard).not.toBeNull();
  expect(desktopExit).not.toBeNull();
  expect(desktopExit!.y).toBeLessThan(desktopBoard!.y);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(board).toBeVisible();
  await expect(exit).toBeVisible();

  const phoneBoard = await board.boundingBox();
  const phoneExit = await exit.boundingBox();
  expect(phoneBoard).not.toBeNull();
  expect(phoneExit).not.toBeNull();
  expect(phoneExit!.y).toBeGreaterThan(phoneBoard!.y + phoneBoard!.height);
  expect(phoneExit!.y + phoneExit!.height).toBeLessThanOrEqual(844);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
