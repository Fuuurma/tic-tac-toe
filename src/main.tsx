import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { ErrorBoundary } from "@/components/errorBoundary";
import { installGlobalErrorHandlers } from "@/lib/errorReporting";
import "@fontsource-variable/syne";
import "@fontsource-variable/source-sans-3";
import "@/index.css";

installGlobalErrorHandlers();

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
