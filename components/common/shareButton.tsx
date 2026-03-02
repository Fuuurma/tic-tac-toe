"use client";

import { Share2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ShareButtonProps {
  title?: string;
  text?: string;
  url?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  title = "Tic Tac Toe",
  text = "Play Tic Tac Toe online!",
  url,
}) => {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const shareUrl = url || window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={share}
      className="gap-1 text-foreground"
      title="Share"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          <span className="hidden sm:inline">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="h-3 w-3" />
          <span className="hidden sm:inline">Share</span>
        </>
      )}
    </Button>
  );
};
