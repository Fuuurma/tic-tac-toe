"use client";

import { useEffect } from "react";

export function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          if (process.env.NODE_ENV === "development") {
            console.log("SW registered:", registration.scope);
          }
        })
        .catch((error) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("SW registration failed:", error);
          }
        });
    }
  }, []);
}
