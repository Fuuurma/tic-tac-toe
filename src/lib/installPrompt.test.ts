import { afterEach, describe, expect, it, vi } from "vitest";
import { createInstallPromptController, isIosDevice } from "./installPrompt";

/**
 * The beforeinstallprompt event is the only signal a browser gives that it
 * will offer an install. The controller stashes it, hands it to the UI once,
 * and gets out of the way — these cases pin that contract without a browser.
 */

interface FakeInstallEvent extends Event {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const fakeInstallEvent = (outcome: "accepted" | "dismissed" = "accepted"): FakeInstallEvent => {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as FakeInstallEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  return event;
};

const setup = () => {
  const target = new EventTarget();
  const controller = createInstallPromptController(target);
  return { target, controller };
};

describe("createInstallPromptController", () => {
  it("starts unavailable and cannot prompt", async () => {
    const { controller } = setup();
    expect(controller.getState()).toBe("unavailable");
    await expect(controller.promptInstall()).resolves.toBe(false);
  });

  it("becomes available on beforeinstallprompt and prevents the default", () => {
    const { target, controller } = setup();
    const event = fakeInstallEvent();
    target.dispatchEvent(event);
    expect(controller.getState()).toBe("available");
    expect(event.defaultPrevented).toBe(true);
  });

  it("prompts once, reports acceptance, and goes quiet until the next offer", async () => {
    const { target, controller } = setup();
    const first = fakeInstallEvent("accepted");
    target.dispatchEvent(first);

    await expect(controller.promptInstall()).resolves.toBe(true);
    expect(first.prompt).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe("unavailable");

    // A second tap before a fresh offer must not re-fire a consumed event.
    await expect(controller.promptInstall()).resolves.toBe(false);
    expect(first.prompt).toHaveBeenCalledTimes(1);

    const second = fakeInstallEvent();
    target.dispatchEvent(second);
    expect(controller.getState()).toBe("available");
  });

  it("reports dismissal without locking out a later offer", async () => {
    const { target, controller } = setup();
    target.dispatchEvent(fakeInstallEvent("dismissed"));
    await expect(controller.promptInstall()).resolves.toBe(false);
    expect(controller.getState()).toBe("unavailable");

    target.dispatchEvent(fakeInstallEvent());
    expect(controller.getState()).toBe("available");
  });

  it("is installed for good once appinstalled fires", () => {
    const { target, controller } = setup();
    target.dispatchEvent(fakeInstallEvent());
    target.dispatchEvent(new Event("appinstalled"));
    expect(controller.getState()).toBe("installed");
    target.dispatchEvent(fakeInstallEvent());
    expect(controller.getState()).toBe("installed");
  });

  it("notifies subscribers on every transition", () => {
    const { target, controller } = setup();
    const listener = vi.fn();
    controller.subscribe(listener);

    target.dispatchEvent(fakeInstallEvent());
    target.dispatchEvent(new Event("appinstalled"));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("isIosDevice", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubNavigator = (
    userAgent: string,
    platform = "",
    maxTouchPoints = 0,
  ) => {
    vi.stubGlobal("navigator", { userAgent, platform, maxTouchPoints });
  };

  it("detects iPhone, iPad and iPod agents", () => {
    for (const agent of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15",
      "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15",
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X)",
    ]) {
      stubNavigator(agent);
      expect(isIosDevice()).toBe(true);
    }
  });

  it("detects iPadOS desktop mode, which sends a Mac agent", () => {
    stubNavigator(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      "MacIntel",
      5,
    );
    expect(isIosDevice()).toBe(true);
  });

  it("leaves a real Mac, Android and desktop Chrome alone", () => {
    stubNavigator(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      "MacIntel",
      0,
    );
    expect(isIosDevice()).toBe(false);

    stubNavigator(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0",
      "Linux armv8l",
      5,
    );
    expect(isIosDevice()).toBe(false);

    stubNavigator(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
      "Win32",
      0,
    );
    expect(isIosDevice()).toBe(false);
  });
});
