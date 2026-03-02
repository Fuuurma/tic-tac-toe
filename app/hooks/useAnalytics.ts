"use client";

import { useCallback } from "react";

interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

export function useAnalytics() {
  const trackEvent = useCallback((name: string, params?: Record<string, string | number | boolean>) => {
    console.log("[Analytics]", { name, params });
    
    if (typeof window !== "undefined" && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag("event", name, params);
    }
  }, []);

  const trackPageView = useCallback((page: string) => {
    trackEvent("page_view", { page });
  }, [trackEvent]);

  return { trackEvent, trackPageView };
}
