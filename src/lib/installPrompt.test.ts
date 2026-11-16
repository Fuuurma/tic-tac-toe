import { describe, expect, it, vi } from "vitest";
import { createInstallPromptController } from "./installPrompt";

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
