import { expect, test } from "@playwright/test";

test("lobby keeps its desktop and phone layouts", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("tic-tac-toe:displayName", "Alice");
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tic Tac Toe Disappear" })).toBeVisible();
  await expect(page.locator("#root")).toHaveScreenshot("f346-lobby-desktop.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page.getByRole("radio", { name: "Join", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Room code/ })).toBeVisible();
  const joinButton = page.getByRole("button", { name: "Join Room" });
  await expect(joinButton).toBeVisible();
  const buttonBox = await joinButton.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(844);
  await expect(page.locator("#root")).toHaveScreenshot("f346-lobby-phone-online-join.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});
