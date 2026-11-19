import {
  GameModes,
  type Color,
  type GameMode,
  type TurnAction,
} from "@/game/constants";
import { t } from "@/i18n/language";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { ctaStyle } from "@/lib/ctaStyle";
import { KeyRound, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/* The lobby card's footer: the Start CTA (label varies by mode and online
   action) plus the line that says why Start is disabled. Pure props in,
   DOM out — the orchestrator in lobbyForm.tsx owns the start gate. */

export function LobbyCardFooter({
  color,
  gameMode,
  onlineAction,
  startDisabled,
  startTitle,
  startReasonId,
  startReason,
  onlineUnavailable,
}: {
  color: Color;
  gameMode: GameMode;
  onlineAction: TurnAction;
  startDisabled: boolean;
  startTitle: string | undefined;
  startReasonId: string;
  startReason: string | null;
  onlineUnavailable: boolean;
}) {
  return (
    <CardFooter
      className={cn(
        // Phones: the CTA sits in thumb reach above the home indicator.
        "flex flex-col gap-2 px-4 pb-[max(1rem,var(--inset-bottom))] pt-2 sm:px-6 sm:pb-6 sm:pt-1",
        // A wide-but-short window (a rotated tablet, or any desktop
        // window under 560px tall) is past the `sm:h-auto` breakpoint,
        // so the card sizes to its content and outgrows the scrollport
        // instead of stretching. Pinning the footer to the bottom of
        // that scrollport keeps Start in thumb reach while the settings
        // above scroll underneath. `overflow-clip` on the Card is what
        // allows this: `overflow-hidden` would establish a scroll
        // container and the footer would stick to a box that never
        // scrolls. On phones this is inert — the footer simply sits
        // below the scrolling content already.
        "landscape-short:sticky landscape-short:bottom-0",
        "landscape-short:border-t landscape-short:border-border/60",
        "landscape-short:bg-background/80 landscape-short:backdrop-blur-md",
        "landscape-short:pb-[max(1.25rem,var(--inset-bottom))]",
      )}
    >
      <Button
        type="submit"
        size="lg"
        variant="glass"
        disabled={startDisabled}
        title={startTitle}
        aria-describedby={startReason ? startReasonId : undefined}
        className={cn(
          "h-12 w-full text-base font-bold sm:h-14",
          startDisabled && "cursor-not-allowed opacity-50",
        )}
        style={ctaStyle(color)}
      >
        {gameMode === GameModes.ONLINE ? (
          <>
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            {onlineAction === "quick"
              ? t("lobby.quickMatch")
              : onlineAction === "create"
                ? t("lobby.createRoom")
                : t("lobby.joinRoom")}
          </>
        ) : (
          <>
            <Play className="h-5 w-5" aria-hidden="true" />
            {t("lobby.start")}
          </>
        )}
      </Button>
      {/* Says why Start is disabled. On desktop the text stays out of the
          layout (sr-only) so the 1280x800 view is unchanged, but it is still
          the button's accessible description. */}
      {startReason && (
        <p
          id={startReasonId}
          role={onlineUnavailable ? "status" : undefined}
          className={cn(
            "text-center text-sm text-muted-foreground",
            onlineUnavailable ? "sm:text-xs sm:text-white/60" : "sm:sr-only",
          )}
        >
          {startReason}
        </p>
      )}
    </CardFooter>
  );
}
