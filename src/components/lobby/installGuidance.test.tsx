// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { PreferencesSheet } from "./preferencesSheet";
import { resetInstallPromptForTests } from "@/lib/installPrompt";

// jsdom does not implement the native <dialog> modal methods that Sheet calls.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
}

// iOS Safari never fires beforeinstallprompt, so the sheet cannot wait for an
// offer there: while the install state is "unavailable" it shows Share-sheet
// guidance instead. These cases pin which install surface each platform and
// state gets.
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const setUserAgent = (userAgent: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
};

const renderSheet = () =>
  render(<PreferencesSheet isOpen onClose={vi.fn()} onHowToPlay={vi.fn()} />);

const fireBeforeInstallPrompt = async () => {
  const offer = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(offer, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted" }),
  });
  await act(async () => {
    window.dispatchEvent(offer);
  });
};

describe("install guidance", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    resetInstallPromptForTests();
    Reflect.deleteProperty(window.navigator, "userAgent");
  });

  it("guides an iPhone to the Share sheet while no prompt is offered", () => {
    setUserAgent(IPHONE_UA);
    renderSheet();

    expect(screen.getByText("Add to Home Screen")).toBeTruthy();
    expect(
      screen.getByText("Tap the Share button, then choose Add to Home Screen."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("keeps the native prompt row when an offer arrives, iOS included", async () => {
    setUserAgent(IPHONE_UA);
    await fireBeforeInstallPrompt();
    renderSheet();

    expect(screen.getByRole("button", { name: "Install app" })).toBeTruthy();
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });

  it("shows no install surface once the app is installed", async () => {
    setUserAgent(IPHONE_UA);
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    renderSheet();

    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });

  it("shows nothing on Android while no prompt is offered", () => {
    setUserAgent(ANDROID_UA);
    renderSheet();

    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });
});
