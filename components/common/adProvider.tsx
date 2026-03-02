"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AdContextType {
  showInterstitial: () => void;
  isAdEnabled: boolean;
}

const AdContext = createContext<AdContextType | undefined>(undefined);

export const useAds = () => {
  const context = useContext(AdContext);
  if (!context) {
    throw new Error("useAds must be used within AdProvider");
  }
  return context;
};

interface AdProviderProps {
  children: React.ReactNode;
  adClient: string;
}

export const AdProvider: React.FC<AdProviderProps> = ({ children, adClient }) => {
  const [showAd, setShowAd] = useState(false);
  const isAdEnabled = !!adClient && adClient.trim() !== "";

  const showInterstitial = useCallback(() => {
    if (isAdEnabled) {
      setShowAd(true);
    }
  }, [isAdEnabled]);

  useEffect(() => {
    if (showAd && isAdEnabled) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error("AdSense interstitial error:", err);
      }
      const timer = setTimeout(() => {
        setShowAd(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showAd, isAdEnabled]);

  return (
    <AdContext.Provider value={{ showInterstitial, isAdEnabled }}>
      {children}
      {showAd && isAdEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white p-4 rounded-lg max-w-lg w-full mx-4">
            <ins
              className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client={adClient}
              data-ad-slot="YOUR_INTERSTITIAL_AD_SLOT"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
            <button
              onClick={() => setShowAd(false)}
              className="mt-4 w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
            >
              Close Ad
            </button>
          </div>
        </div>
      )}
    </AdContext.Provider>
  );
};
