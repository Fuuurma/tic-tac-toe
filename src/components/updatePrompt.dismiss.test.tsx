import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { builtinEnvironments } from "vitest/runtime";
import { setLocale } from "@/i18n/language";
import { UpdatePrompt } from "./updatePrompt";
import {
  notifyUpdateAvailable,
  resetUpdatePromptForTests,
  setUpdatePromptGameActive,
} from "./updatePromptStore";

let teardownEnvironment: (() => unknown) | undefined;

beforeAll(async () => {
  const env = await builtinEnvironments.jsdom.setup(globalThis, {});
  teardownEnvironment = () => env.teardown(globalThis);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterAll(async () => {
  await teardownEnvironment?.();
});

afterEach(() => {
  cleanup();
  resetUpdatePromptForTests();
  setLocale("en");
});

describe("UpdatePrompt dismiss and game suppression", () => {
  it("hides when dismissed and returns on the next update notification", () => {
    const view = render(<UpdatePrompt />);
    act(() => {
      notifyUpdateAvailable();
    });
    expect(view.getByRole("status")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));

    expect(view.queryByRole("status")).toBeNull();
    expect(view.queryByRole("button")).toBeNull();

    act(() => {
      notifyUpdateAvailable();
    });

    expect(view.getByRole("status")).toBeTruthy();
    expect(view.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("stays dismissed through a game session", () => {
    const view = render(<UpdatePrompt />);
    act(() => {
      notifyUpdateAvailable();
    });
    fireEvent.click(view.getByRole("button", { name: "Dismiss" }));

    act(() => {
      setUpdatePromptGameActive(true);
    });
    act(() => {
      setUpdatePromptGameActive(false);
    });

    expect(view.queryByRole("status")).toBeNull();
  });

  it("is absent while a game is active and returns when it ends", () => {
    const view = render(<UpdatePrompt />);
    act(() => {
      notifyUpdateAvailable();
    });
    expect(view.getByRole("status")).toBeTruthy();

    act(() => {
      setUpdatePromptGameActive(true);
    });
    expect(view.queryByRole("status")).toBeNull();

    act(() => {
      setUpdatePromptGameActive(false);
    });
    expect(view.getByRole("status")).toBeTruthy();
  });

  it("stays hidden when the update arrives mid-game and shows on exit", () => {
    const view = render(<UpdatePrompt />);
    act(() => {
      setUpdatePromptGameActive(true);
      notifyUpdateAvailable();
    });

    expect(view.queryByRole("status")).toBeNull();

    act(() => {
      setUpdatePromptGameActive(false);
    });
    expect(view.getByRole("status")).toBeTruthy();
  });
});
