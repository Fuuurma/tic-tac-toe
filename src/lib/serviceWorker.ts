import { reportError } from "@/lib/errorReporting";

const SKIP_WAITING_MESSAGE = "SKIP_WAITING";

let currentRegistration: ServiceWorkerRegistration | null = null;
let updateAccepted = false;

function watchForUpdate(
  registration: ServiceWorkerRegistration,
  onUpdateAvailable?: () => void,
): void {
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        onUpdateAvailable?.();
      }
    });
  });
  if (registration.waiting && navigator.serviceWorker.controller) {
    onUpdateAvailable?.();
  }
}

/**
 * Registers the app-shell service worker emitted at dist/sw.js by the vite
 * build (scripts/service-worker.js + the precache manifest). Production
 * builds only: the dev server serves no worker, and one caching localhost
 * modules would only obscure HMR. A refused or failed registration is
 * reported but never fatal — the app is fully functional without it.
 */
export function registerServiceWorker(options?: {
  onUpdateAvailable?: () => void;
}): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateAccepted) window.location.reload();
  });

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        currentRegistration = registration;
        watchForUpdate(registration, options?.onUpdateAvailable);
      })
      .catch((error: unknown) => {
        reportError(error, { source: "serviceWorker.register" });
      });
  };

  // After `load` so the worker's install fetches never compete with the
  // first paint's own requests.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

export function requestUpdate(): void {
  const waiting = currentRegistration?.waiting;
  if (!waiting) return;
  updateAccepted = true;
  waiting.postMessage({ type: SKIP_WAITING_MESSAGE });
}
