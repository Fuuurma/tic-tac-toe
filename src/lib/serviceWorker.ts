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

  const reportRegistrationError = (error: unknown) => {
    reportError(error, { source: "serviceWorker.register" });
  };

  const register = () => {
    // register() can also throw synchronously (a broken or locked-down
    // implementation), and that throw would otherwise escape the boot path
    // before `.catch` ever exists to take the rejection.
    try {
      navigator.serviceWorker.register("/sw.js").catch(reportRegistrationError);
    } catch (error) {
      reportRegistrationError(error);
    }
  };

  // After `load` so the worker's install fetches never compete with the
  // first paint's own requests.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
