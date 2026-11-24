"@vitest-environment jsdom";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Color } from "@/game/constants";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import { getColorLabel } from "@/i18n/language";
import { loadPreferences } from "@/lib/preferences";

vi.mock("@/components/backgroundPattern", () => ({ BackgroundPattern: () => null }));

vi.mock("@/hooks/usePlayerCount", () => ({
  usePlayerCount: () => ({
    count: null,
    refresh: vi.fn(),
    serverDown: false,
    online: true,
  }),
}));

vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const { default: App } = await import("./App");

const openColorPicker = (name: string) => {
  fireEvent.click(screen.getByRole("button", { name }));
};

const pickColor = (name: string, color: Color) => {
  openColorPicker(name);
  const group = screen.getByRole("radiogroup", { name });
  fireEvent.click(within(group).getByRole("radio", { name: getColorLabel(color) }));
};

const selectedColor = (name: string): string | undefined => {
  const group = screen.getByRole("radiogroup", { name });
  const checked = within(group)
    .getAllByRole("radio")
    .filter((radio) => radio.getAttribute("aria-checked") === "true");
  expect(checked).toHaveLength(1);
  return checked[0]?.getAttribute("aria-label") ?? undefined;
};

const startGameButton = () =>
  screen.getByRole("button", { name: "Start Game" }) as HTMLButtonElement;

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  window.localStorage.setItem(IDENTITY_STORAGE_KEYS.guestId, "guest:returning");
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("lobby player colours", () => {
  it("swaps the opponent's colour when Player 1 picks it in Friend mode", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "vs Friend" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit your player settings" }));

    pickColor("Your color", Color.RED);

    fireEvent.click(screen.getByRole("tab", { name: "Opponent" }));
    expect(selectedColor("Opponent color")).toBe(getColorLabel(Color.BLUE));

    expect(startGameButton().disabled).toBe(false);

    const prefs = loadPreferences();
    expect(prefs.color).toBe(Color.RED);
    expect(prefs.opponentColor).toBe(Color.BLUE);
  });
});

describe("mid-game player colours", () => {
  it("swaps the opponent's colour when the player picks it in Friend mode", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "vs Friend" }));
    fireEvent.click(startGameButton());

    fireEvent.click(screen.getByRole("button", { name: "Edit player settings" }));
    pickColor("Your color", Color.RED);

    fireEvent.click(screen.getByRole("tab", { name: "Opponent" }));
    expect(selectedColor("Opponent color")).toBe(getColorLabel(Color.BLUE));

    const prefs = loadPreferences();
    expect(prefs.color).toBe(Color.RED);
    expect(prefs.opponentColor).toBe(Color.BLUE);
  });

  it("gives the computer the opposite colour when the player picks one", () => {
    render(<App />);

    fireEvent.click(startGameButton());

    fireEvent.click(screen.getByRole("button", { name: "Edit player settings" }));
    pickColor("Your color", Color.RED);

    fireEvent.click(screen.getByRole("tab", { name: "Opponent" }));
    expect(selectedColor("Opponent color")).toBe(getColorLabel(Color.BLUE));

    const prefs = loadPreferences();
    expect(prefs.color).toBe(Color.RED);
    expect(prefs.opponentColor).toBe(Color.BLUE);
  });
});
