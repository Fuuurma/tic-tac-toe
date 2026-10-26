// @vitest-environment jsdom

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Color, SymbolShape } from "@/game/constants";
import { IDENTITY_STORAGE_KEYS } from "@/lib/identity";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";
import { loadPreferences } from "@/lib/preferences";
import { OnboardingFlow } from "./onboardingFlow";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const storedOutcome = () => window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
const storedName = () => window.localStorage.getItem(IDENTITY_STORAGE_KEYS.displayName);

function start(mode: "first-run" | "replay" = "first-run") {
  const onExit = vi.fn();
  render(<OnboardingFlow mode={mode} onExit={onExit} />);
  return { onExit };
}

const press = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Welcome, then the profile step with the given picks. */
function setUpPlayer({ name = "Maria", color = "Green", symbol = "Star" } = {}) {
  press("Get started");
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("radio", { name: color }));
  fireEvent.click(screen.getByRole("radio", { name: symbol }));
  press("Continue");
}

/** Plays the practice round to the end the way a casual player would. */
function playPracticeToTheWin() {
  for (let turn = 0; turn < 30 && !screen.queryByText("Three in a row. You win!"); turn += 1) {
    const suggested = screen.queryByRole("button", { name: /suggested move/ });
    const cell = suggested ?? screen.getAllByRole("button", { name: /, empty/ })[0];
    fireEvent.click(cell);
    advance(1000);
  }
}

describe("welcome", () => {
  it("lets an experienced player skip everything and remembers that", () => {
    const { onExit } = start();

    press(/skip/i);

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(storedOutcome()).toBe("skipped");
    // Skipping must not invent a profile: the lobby falls back to its own defaults.
    expect(storedName()).toBeNull();
    expect(loadPreferences()).toEqual({});
  });

  it("previews the steps so the player knows what a minute buys them", () => {
    start();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/oldest mark vanishes/i);
    expect(screen.getByText(/practice round/i)).toBeTruthy();
  });
});

describe("profile step", () => {
  it("starts with a ready-to-use name so Continue is never a dead end", () => {
    start();
    press("Get started");

    const name = (screen.getByLabelText("Your name") as HTMLInputElement).value;
    expect(name.length).toBeGreaterThanOrEqual(2);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("moves focus to the new step so keyboard and screen reader users follow along", () => {
    start();
    press("Get started");
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Set up your player" }),
    );
  });

  it("blocks Continue while the name is too short, and says why", () => {
    start();
    press("Get started");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "M" } });

    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/at least 2 characters/i)).toBeTruthy();
  });

  it("strips characters the app never accepts as the player types", () => {
    start();
    press("Get started");
    const input = screen.getByLabelText("Your name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "<b>Maria</b>" } });
    expect(input.value).toBe("bMaria/b");
  });

  it("rolls a new random name on request", () => {
    start();
    press("Get started");
    const input = screen.getByLabelText("Your name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Maria" } });

    press("Suggest another name");

    expect(input.value).not.toBe("Maria");
    expect(input.value.length).toBeGreaterThanOrEqual(2);
  });

  it("saves the profile as soon as it is confirmed, even if the rest is skipped", () => {
    const { onExit } = start();
    setUpPlayer();

    expect(storedName()).toBe("Maria");
    expect(loadPreferences()).toMatchObject({
      color: Color.GREEN,
      playerShape: SymbolShape.STAR,
      // The lobby derives the opponent's color from this, so it must not clash.
      opponentColor: Color.PURPLE,
    });

    press(/skip/i);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(storedOutcome()).toBe("skipped");
    expect(storedName()).toBe("Maria");
  });

  it("does not save a half-finished profile when skipped", () => {
    start();
    press("Get started");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Maria" } });

    press(/skip/i);

    expect(storedName()).toBeNull();
  });
});

describe("practice round", () => {
  it("opens on the real board and coaches the first move", () => {
    start();
    setUpPlayer();

    expect(screen.getByRole("group", { name: "Tic Tac Toe game board" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/place your first mark/i);
    expect(screen.getAllByRole("button", { name: /, empty/ })).toHaveLength(9);
  });

  it("answers each move with the AI's, using the player's own symbol", () => {
    vi.useFakeTimers();
    start();
    setUpPlayer();

    fireEvent.click(screen.getByRole("button", { name: "Row 1 column 1, empty" }));
    expect(screen.getByRole("button", { name: /Row 1 column 1, occupied by Star/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /occupied by/ })).toHaveLength(1);

    advance(1000);
    expect(screen.getAllByRole("button", { name: /occupied by/ })).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toMatch(/second mark/i);
  });

  it("points at the oldest mark on the third, then shows it vanish on the fourth", () => {
    vi.useFakeTimers();
    start();
    setUpPlayer();

    // The AI blocks, so which cells survive depends on its replies; play whatever is open.
    const playOpenCell = () => {
      fireEvent.click(screen.getAllByRole("button", { name: /, empty/ })[0]);
      advance(1000);
    };
    playOpenCell();
    playOpenCell();
    playOpenCell();

    expect(screen.getByRole("status").textContent).toMatch(/oldest mark is blinking/i);
    // Both sides blink their oldest mark; the player's own is the one the lesson is about.
    expect(
      screen.getAllByRole("button", { name: /occupied by Star, next to be removed/ }),
    ).toHaveLength(1);

    fireEvent.click(screen.getAllByRole("button", { name: /, empty/ })[0]);
    expect(screen.getByRole("status").textContent).toMatch(/it vanished/i);
    expect(document.querySelector('[data-vanishing="true"]')).not.toBeNull();
  });

  it("can be finished, and finishing leads to the ready screen and a remembered outcome", () => {
    vi.useFakeTimers();
    const { onExit } = start();
    setUpPlayer();

    playPracticeToTheWin();
    expect(screen.getByText("Three in a row. You win!")).toBeTruthy();

    press("Continue");
    expect(screen.getByRole("heading", { name: /you're all set, maria/i })).toBeTruthy();
    expect(screen.getByText(/10 seconds/i)).toBeTruthy();
    expect(onExit).not.toHaveBeenCalled();

    press("Start playing");
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(storedOutcome()).toBe("done");
  });

  it("can be skipped mid-round without losing the profile", () => {
    vi.useFakeTimers();
    const { onExit } = start();
    setUpPlayer();
    fireEvent.click(screen.getByRole("button", { name: "Row 2 column 2, empty" }));

    press(/skip/i);

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(storedOutcome()).toBe("skipped");
    expect(storedName()).toBe("Maria");
  });
});

describe("replay", () => {
  it("goes straight to practice with the saved profile and never touches the first-run record", () => {
    vi.useFakeTimers();
    window.localStorage.setItem(IDENTITY_STORAGE_KEYS.displayName, "Maria");
    window.localStorage.setItem(
      "tic-tac-toe:preferences",
      JSON.stringify({ color: Color.PINK, playerShape: SymbolShape.HEART }),
    );
    const { onExit } = start("replay");

    expect(screen.queryByText("Get started")).toBeNull();
    expect(screen.getByRole("group", { name: "Tic Tac Toe game board" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Row 1 column 1, empty" }));
    expect(screen.getByRole("button", { name: /occupied by Heart/ })).toBeTruthy();

    playPracticeToTheWin();
    press("Back to lobby");

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(storedOutcome()).toBeNull();
    expect(storedName()).toBe("Maria");
  });
});
