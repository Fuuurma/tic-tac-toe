"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PreferencesSheet } from "./preferencesSheet";
import { getOrCreateGuestIdentity } from "@/lib/identity";
import { resetInstallPromptForTests } from "@/lib/installPrompt";

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

const RECORD = {
  totalGames: 4,
  wins: 3,
  losses: 1,
  currentWinStreak: 2,
  bestWinStreak: 3,
  breakdown: {
    "VS_FRIEND": { wins: 3, losses: 1 },
  },
};

const ZEROED = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  currentWinStreak: 0,
  bestWinStreak: 0,
  breakdown: {},
};

const statsKey = () =>
  `tic-tac-toe:stats:${getOrCreateGuestIdentity().guestId}`;

const stored = () => {
  const raw = window.localStorage.getItem(statsKey());
  return raw ? JSON.parse(raw) : null;
};

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(statsKey(), JSON.stringify(RECORD));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetInstallPromptForTests();
});

describe("PreferencesSheet reset record", () => {
  it("asks first, keeps the record on cancel and zeroes it on confirm", async () => {
    render(
      <PreferencesSheet isOpen onClose={vi.fn()} onHowToPlay={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset record" }));
    expect(
      await screen.findByRole("dialog", { name: "Reset your record?" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Reset your record?" }),
      ).toBeNull(),
    );
    expect(stored()).toEqual(RECORD);

    fireEvent.click(screen.getByRole("button", { name: "Reset record" }));
    expect(
      await screen.findByRole("dialog", { name: "Reset your record?" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(stored()).toEqual(ZEROED));
  });
});
