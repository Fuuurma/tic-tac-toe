interface ErrorReportContext {
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
