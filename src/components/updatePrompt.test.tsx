import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { builtinEnvironments } from "vitest/runtime";
import { setLocale } from "@/i18n/language";
import { UpdatePrompt } from "./updatePrompt";
import {
  notifyUpdateAvailable,
  resetUpdatePromptForTests,
} from "./updatePromptStore";

const mocks = vi.hoisted(() => ({ requestUpdate: vi.fn() }));

vi.mock("@/lib/serviceWorker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/serviceWorker")>();
  return { ...actual, requestUpdate: mocks.requestUpdate };
});

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
  mocks.requestUpdate.mockClear();
});

describe("UpdatePrompt", () => {
  it("renders nothing until the service worker reports an update", () => {
    const view = render(<UpdatePrompt />);

    expect(view.queryByRole("status")).toBeNull();
    expect(view.queryByRole("button")).toBeNull();
  });

  it("shows the banner once when an update is available", () => {
    const view = render(<UpdatePrompt />);

    act(() => {
      notifyUpdateAvailable();
      notifyUpdateAvailable();
    });

    expect(view.getByText("Update available")).toBeTruthy();
    expect(view.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(view.getAllByRole("status")).toHaveLength(1);
  });

  it("asks the service worker to activate the update when Reload is clicked", () => {
    const view = render(<UpdatePrompt />);
    act(() => {
      notifyUpdateAvailable();
    });

    fireEvent.click(view.getByRole("button", { name: "Reload" }));

    expect(mocks.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows the banner in Spanish when the locale is es", () => {
    setLocale("es");
    const view = render(<UpdatePrompt />);
    act(() => {
      notifyUpdateAvailable();
    });

    expect(view.getByText("Actualización disponible")).toBeTruthy();
    expect(view.getByRole("button", { name: "Recargar" })).toBeTruthy();
  });

  it("shows the banner on mount when the update was reported before render", () => {
    notifyUpdateAvailable();
    const view = render(<UpdatePrompt />);

    expect(view.getByRole("status")).toBeTruthy();
    expect(view.getByRole("button", { name: "Reload" })).toBeTruthy();
  });
});
