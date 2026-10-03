export interface ErrorReportContext {
  source?: string;
  componentStack?: string | null;
  [key: string]: unknown;
}

export function reportError(error: unknown, context?: ErrorReportContext): void {
  if (context === undefined) {
    console.error(error);
  } else {
    console.error(error, context);
  }

  const endpoint = import.meta.env.VITE_ERROR_REPORT_URL;
  if (!endpoint) return;

  try {
    const payload = JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      url: typeof window === "undefined" ? undefined : window.location?.href,
      timestamp: new Date().toISOString(),
    });
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Reporting must never break the host application.
  }
}

let installed = false;

export function installGlobalErrorHandlers(
  reporter: typeof reportError = reportError,
): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.onerror = (message, _source, _lineno, _colno, error) => {
    reporter(error ?? message, { source: "window.onerror" });
  };
  window.onunhandledrejection = (event) => {
    reporter(event.reason, { source: "unhandledrejection" });
  };
}
