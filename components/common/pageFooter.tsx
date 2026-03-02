import React from "react";
import { AdSenseBanner } from "./adsenseBanner";

const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "";
const adSlot = process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || "";

const PageFooter = () => {
  return (
    <footer className="w-full max-w-4xl flex flex-col items-center gap-2">
      {adClient && adSlot && <AdSenseBanner adClient={adClient} adSlot={adSlot} />}
      <div className="py-4 text-center text-sm text-muted-foreground">
        Created by{" "}
        <a
          href="https://github.com/fuuurma"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          @fuuurma
        </a>
      </div>
    </footer>
  );
};

export default PageFooter;
