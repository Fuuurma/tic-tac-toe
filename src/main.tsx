import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { ErrorBoundary } from "@/components/errorBoundary";
import { initLocale } from "@/i18n/language";
import { installGlobalErrorHandlers } from "@/lib/errorReporting";
import "@fontsource-variable/syne";
import "@fontsource-variable/source-sans-3";
import "@/index.css";

installGlobalErrorHandlers();
// Saved language (or the browser's, for Spanish-first visitors) before
// anything renders, so the first paint is already in the right language.
initLocale();

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
