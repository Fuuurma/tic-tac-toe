import { useSyncExternalStore } from "react";

/**
 * The browser's install offer, kept until our UI asks for it.
 *
 * Chrome fires `beforeinstallprompt` once the PWA criteria are met and holds
 * the native prompt until the page calls `prompt()`. The event is not in
 * lib.dom, so the two members we use are declared here. iOS Safari never
 * fires it — iOS installs go through Share → Add to Home Screen — so the
 * settings row simply never appears there.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = "unavailable" | "available" | "installed";

/** The slice of EventTarget the controller needs, so tests can pass a plain
 *  EventTarget instead of window. */
export interface InstallPromptSource {
  addEventListener(
    type: "beforeinstallprompt" | "appinstalled",
    listener: (event: Event) => void,
  ): void;
}

export interface InstallPromptController {
  getState(): InstallState;
  subscribe(listener: () => void): () => void;
  /** Shows the native prompt for a stashed offer; true when accepted. */
  promptInstall(): Promise<boolean>;
  /** Drops the stashed offer and the installed flag. Test hook. */
  reset(): void;
}

export function createInstallPromptController(
  source: InstallPromptSource,
): InstallPromptController {
  let deferred: BeforeInstallPromptEvent | null = null;
  let installed = false;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const getState = (): InstallState =>
    installed ? "installed" : deferred ? "available" : "unavailable";

  source.addEventListener("beforeinstallprompt", (event) => {
    // The default is the browser's own mini-infobar; the settings row owns
    // the ask, so the event is always suppressed while we hold it.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  source.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });

  const promptInstall = async (): Promise<boolean> => {
    const event = deferred;
    if (!event) return false;
    // Consume before prompting: the event fires prompt() at most once, and a
    // dismissed offer must not leave a dead row behind. A fresh
    // beforeinstallprompt can arrive later and re-arm the row.
    deferred = null;
    emit();
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      return outcome === "accepted";
    } catch {
      return false;
    }
  };

  return {
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    promptInstall,
    reset() {
      deferred = null;
      installed = false;
      emit();
    },
  };
}

// Module-level state, the same shape as the locale store: every consumer
// reads one value without a provider, and a language-free sheet deep in the
// tree subscribes the same way. Listeners attach at import, which is bundle
// eval — well before the browser can fire the event.
const controller =
  typeof window === "undefined" ? null : createInstallPromptController(window);

const inert: InstallPromptController = {
  getState: () => "unavailable",
  subscribe: () => () => {},
  promptInstall: () => Promise.resolve(false),
  reset: () => {},
};

const active = controller ?? inert;

export function getInstallState(): InstallState {
  return active.getState();
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  return active.subscribe(listener);
}

export function useInstallPrompt(): {
  state: InstallState;
  promptInstall: () => Promise<boolean>;
} {
  const state = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallState,
    getInstallState,
  );
  return { state, promptInstall: active.promptInstall };
}

/** Returns the window-bound controller to "unavailable" between tests. */
export function resetInstallPromptForTests(): void {
  active.reset();
}
