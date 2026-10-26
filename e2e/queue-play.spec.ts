import type { Page, WebSocketRoute } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Play the computer while a Quick Match search is running.
 *
 * The matchmaking Worker is scripted here, not reached: this spec is about
 * what the player sees while the queue does its work, and it must be able to
 * pair, expire or hold the search on command without putting tickets into a
 * live queue where a real player could be paired with a test.
 */

const MATCHMAKING = "http://127.0.0.1:8787";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

interface ScriptedQueue {
  /** The next poll answers `matched`, seating the player as host. */
  pair: () => void;
  /** The next poll answers that the ticket no longer exists. */
  expire: () => void;
  leaves: () => number;
  joins: () => number;
  /** The scripted room relay, once the client has dialled it. */
  relay: () => WebSocketRoute | null;
}

async function scriptQueue(page: Page): Promise<ScriptedQueue> {
  let next: "waiting" | "matched" | "expired" = "waiting";
  let leaves = 0;
  let joins = 0;
  let relay: WebSocketRoute | null = null;

  await page.route(`${MATCHMAKING}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/health")) {
      await json({ ok: true, game: "tictactoe", waiting: 3, matches: 0 });
    } else if (path.endsWith("/join")) {
      joins += 1;
      next = "waiting";
      await json({ status: "waiting", ticket: `ticket-${joins}`, roomId: "E2EROOM" });
    } else if (path.endsWith("/poll")) {
      if (next === "expired") {
        await route.fulfill({
          status: 404,
          headers: { ...CORS, "content-type": "text/plain" },
          body: "ticket not found",
        });
      } else if (next === "matched") {
        await json({
          status: "matched",
          slotToken: "slot-e2e",
          match: {
            roomId: "E2EROOM",
            role: "host",
            host: { peerId: "p-host", displayName: "You", guestId: "g-host" },
            guest: { peerId: "p-guest", displayName: "Rival", guestId: "g-guest" },
          },
        });
      } else {
        await json({ status: "waiting", ticket: "ticket", roomId: "E2EROOM" });
      }
    } else if (path.endsWith("/leave")) {
      leaves += 1;
      await json({ ok: true });
    } else {
      await route.fulfill({ status: 404, headers: CORS });
    }
  });
  // The relay holds the socket open and says nothing until the test speaks:
  // a quiet room is exactly what "paired, connecting" looks like.
  await page.routeWebSocket(/\/room\//, (ws) => {
    relay = ws;
  });

  return {
    pair: () => {
      next = "matched";
    },
    expire: () => {
      next = "expired";
    },
    leaves: () => leaves,
    joins: () => joins,
    relay: () => relay,
  };
}

async function startQuickSearch(page: Page) {
  await page.goto("/");
  await page.getByRole("radio", { name: "Online", exact: true }).click();
  await page.getByRole("radio", { name: "Quick", exact: true }).click();
  await page.getByRole("button", { name: "Quick Match" }).click();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
}

const playWhileWaiting = (page: Page) =>
  page.getByRole("button", { name: "Play the computer while you wait" });

/** Plays the first cell the human is allowed to take right now. */
async function makeAMove(page: Page) {
  await page.locator("button[aria-label^='Row']:not([disabled])").first().click();
  await expect(page.locator("button[aria-label*='occupied']").first()).toBeVisible();
}

test("a searching player can fill the wait with the computer, then is handed to the real match", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const queue = await scriptQueue(page);
  await startQuickSearch(page);

  // The search card leads with how crowded the queue is, then the offer.
  await expect(page.getByText(/2 other players are looking/)).toBeVisible();
  await playWhileWaiting(page).click();

  // A real game, with the search alive as a one-line strip above it.
  await expect(page.getByText("vs Computer")).toBeVisible();
  await expect(page.getByText("Searching for an opponent")).toBeVisible();
  await makeAMove(page);

  // Paired mid-game: told, and the old board can no longer be tapped.
  queue.pair();
  await expect(page.getByText("Opponent found")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Starting your match…")).toBeVisible();
  await expect(page.locator("button[aria-label^='Row']:not([disabled])")).toHaveCount(0);

  // The relay seats the host, the rival's socket arrives, and the rival
  // introduces itself: only that last frame starts the real game, so only
  // then does it replace the warm-up.
  const relay = queue.relay();
  expect(relay).not.toBeNull();
  const send = (frame: object) => relay!.send(JSON.stringify(frame));
  send({ type: "welcome", role: "host", opponent: null });
  await expect(page.getByText("Opponent found")).toBeVisible();
  send({ type: "peer-joined", opponent: { guestId: "g-guest", displayName: "Rival" } });
  await expect(page.getByText("Opponent found")).toBeVisible();
  send({ type: "join", displayName: "Rival", guestId: "g-guest", preferredColor: "red" });
  await expect(page.getByText("Opponent found")).toBeHidden();
  await expect(page.getByText("vs Computer")).toBeHidden();
  await expect(page.getByText("Online", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Rival,/ })).toBeVisible();

  // A consumed ticket is never released, and no room code leaked on the way.
  expect(queue.leaves()).toBe(0);
  await expect(page.getByLabel(/Room code/)).toHaveCount(0);
});

test("leaving the queue mid-game releases the ticket and returns to the lobby", async ({ page }) => {
  const queue = await scriptQueue(page);
  await startQuickSearch(page);
  await playWhileWaiting(page).click();
  await makeAMove(page);

  await page.getByRole("button", { name: "Leave queue" }).click();

  // The lobby remounts in its default mode, so look for the mode picker.
  await expect(page.getByRole("radio", { name: "Online", exact: true })).toBeVisible();
  await expect(page.getByText("Searching for an opponent")).toBeHidden();
  await expect.poll(() => queue.leaves()).toBe(1);
});

test("ending the computer game returns to the search card without leaving the queue", async ({
  page,
}) => {
  const queue = await scriptQueue(page);
  await startQuickSearch(page);
  await playWhileWaiting(page).click();

  await page.getByRole("button", { name: "Exit game" }).click();

  await expect(playWhileWaiting(page)).toBeVisible();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
  expect(queue.leaves()).toBe(0);
});

test("when the search expires mid-game the game stays and another search is one tap", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const queue = await scriptQueue(page);
  await startQuickSearch(page);
  await playWhileWaiting(page).click();
  await makeAMove(page);

  queue.expire();
  await expect(page.getByText(/search expired/)).toBeVisible({ timeout: 15_000 });
  // The board and the move already made are untouched.
  await expect(page.locator("button[aria-label*='occupied']").first()).toBeVisible();

  await page.getByRole("button", { name: "Search again" }).click();
  await expect(page.getByText("Searching for an opponent")).toBeVisible();
  await expect.poll(() => queue.joins()).toBe(2);
  await expect(page.locator("button[aria-label*='occupied']").first()).toBeVisible();
});
