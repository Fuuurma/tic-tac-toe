import { reportError } from "@/lib/errorReporting";

/**
 * Registers the app-shell service worker emitted at dist/sw.js by the vite
 * build (scripts/service-worker.js + the precache manifest). Production
 * builds only: the dev server serves no worker, and one caching localhost
 * modules would only obscure HMR. A refused or failed registration is
 * reported but never fatal — the app is fully functional without it.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
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
