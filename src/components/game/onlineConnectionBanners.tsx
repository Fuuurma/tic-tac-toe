import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { PeerRoomState } from "@/hooks/usePeerRoom";
import { Check as CheckIcon, Copy as CopyIcon, Link2 as LinkIcon } from "lucide";
import { Loader2, Share2, Wifi } from "lucide-react";
import { MorphIcon } from "morphicons/react";

type OnlineAction = "create" | "join" | "quick";
type ConnectionState = Pick<PeerRoomState, "status" | "roomId" | "queuePosition" | "message">;

export interface OnlineConnectionBannersProps {
  state: ConnectionState;
  action: OnlineAction;
  waiting?: number;
  actions: {
    cancel: () => void;
    exit: () => void;
    retry: () => void;
    retryQuickMatch: () => void;
  };
}

export function OnlineConnectionBanners({ state, action, waiting, actions }: OnlineConnectionBannersProps) {
  return (
    <>
      {/* Room codes are invitation tokens for a specific player. Quick Match
          is paired by the service, so its internal room id stays private. */}
      {state.status === "waiting" && action === "create" && (
        <RoomIdShare
          roomId={state.roomId}
          origin={typeof window !== "undefined" ? window.location.origin : ""}
          onCancel={actions.cancel}
        />
      )}
      {state.status === "waiting" && action === "quick" && (
        <OnlineConnectionState
          message="Finding an opponent…"
          detail={quickMatchDetail(waiting, state.queuePosition)}
          hint="No room code needed. Just wait here and we'll start you."
          cancelLabel="Cancel search"
          onCancel={actions.cancel}
        />
      )}
      {state.status === "creating" && (
        <OnlineConnectionState
          message={action === "quick" ? "Finding an opponent…" : "Creating your room…"}
          detail={
            action === "quick" && state.queuePosition != null
              ? `Position ${state.queuePosition} in queue`
              : undefined
          }
          onCancel={actions.cancel}
        />
      )}
      {state.status === "connecting" && (
        <OnlineConnectionState
          // Keep the transport's specific message, such as a room-not-found
          // error, instead of replacing it with a generic connecting label.
          message={state.message || "Joining room…"}
          onCancel={actions.cancel}
        />
      )}
      {state.status === "reconnecting" && (
        <div
          role="status"
          aria-live="polite"
          className="glass flex w-full flex-col items-center gap-2 border-amber-500/40 bg-amber-500/15 px-3 py-2 text-amber-950 dark:text-amber-50"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {state.message || "Reconnecting…"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Room stays open ~30s while the connection restores.
          </span>
          <Button size="sm" variant="glass" onClick={actions.retry}>
            Retry now
          </Button>
        </div>
      )}
      {state.status === "error" && (
        <div
          role="alert"
          className="glass flex w-full flex-col items-center gap-2 border-destructive/30 bg-destructive/15 px-3 py-2"
        >
          <span className="text-xs text-destructive">
            {state.message || "We could not connect to this room."}
          </span>
          <div className="flex flex-wrap justify-center gap-1.5">
            {action === "quick" && (
              <Button size="sm" variant="glass" onClick={actions.retryQuickMatch}>
                Try again
              </Button>
            )}
            <Button size="sm" variant="glass" onClick={actions.exit}>
              Back to setup
            </Button>
          </div>
        </div>
      )}
      {state.status === "disconnected" && state.message && (
        <div
          role="status"
          aria-live="polite"
          className="glass flex w-full flex-col items-center gap-2 border-amber-500/40 bg-amber-500/15 px-3 py-2"
        >
          <span className="text-xs font-medium text-amber-950 dark:text-amber-50">
            {state.message}
          </span>
          <Button size="sm" variant="glass" onClick={actions.exit}>
            Back to setup
          </Button>
        </div>
      )}
    </>
  );
}

function quickMatchDetail(waiting: number | undefined, queuePosition: number | null): string {
  if (waiting === undefined) return "Checking the queue.";
  // The health read may land before this join registers, so waiting can
  // undercount by one until the next poll.
  const others = Math.max(0, waiting - 1);
  if (others === 0) {
    return "You're first in the queue. We'll pair you as soon as someone else is looking.";
  }
  const place = queuePosition != null ? ` You're number ${queuePosition}.` : "";
  return `${others} other ${others === 1 ? "player is" : "players are"} looking.${place}`;
}

function RoomIdShare({
  roomId,
  origin,
  onCancel,
}: {
  roomId: string;
  origin: string;
  onCancel: () => void;
}) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [copyError, setCopyError] = useState(false);
  const shareUrl = origin ? `${origin}/?room=${roomId}` : roomId;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const onCopy = async (kind: "code" | "link", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(false);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopyError(true);
    }
  };

  const onShare = async () => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: "Tic Tac Toe Disappear room",
        text: `Join my Tic Tac Toe Disappear room with code ${roomId}`,
        url: shareUrl,
      });
    } catch {
      // The user may cancel the native share sheet; no error is needed.
    }
  };

  return (
    <div className="glass flex w-full flex-col items-center gap-2 p-3">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
      >
        <Wifi className="size-3.5 text-[rgb(var(--player-color))]" aria-hidden="true" />
        Room ready
      </div>
      <p className="text-xs leading-tight text-muted-foreground">
        Send this code to your opponent; you start when they join.
      </p>
      <span className="glass-cell max-w-full break-all rounded-lg px-3 py-2 font-mono text-sm font-bold tracking-wide text-foreground sm:text-base">
        <span className="sr-only">Room code </span>
        {roomId}
      </span>
      <div className="grid w-full gap-1.5 sm:flex sm:w-auto">
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("code", roomId)}
          className="w-full sm:w-auto"
        >
          <MorphIcon
            icon={copied === "code" ? CheckIcon : CopyIcon}
            className={`size-3.5 ${copied === "code" ? "text-emerald-500" : ""}`}
            aria-hidden="true"
          />
          Copy code
        </Button>
        <Button
          size="sm"
          variant="glass"
          onClick={() => onCopy("link", shareUrl)}
          className="w-full sm:w-auto"
        >
          <MorphIcon
            icon={copied === "link" ? CheckIcon : LinkIcon}
            className={`size-3.5 ${copied === "link" ? "text-emerald-500" : ""}`}
            aria-hidden="true"
          />
          Copy invite link
        </Button>
        {canShare && (
          <Button size="sm" variant="glass" onClick={onShare} className="w-full sm:w-auto">
            <Share2 className="size-3.5" aria-hidden="true" />
            Share
          </Button>
        )}
        <Button size="sm" variant="glass" onClick={onCancel} className="w-full sm:w-auto">
          Back to setup
        </Button>
      </div>
      {copied && (
        <span role="status" aria-live="polite" className="text-xs text-emerald-600 dark:text-emerald-400">
          {copied === "code" ? "Room code copied." : "Invite link copied."}
        </span>
      )}
      {copyError && (
        <span role="status" aria-live="polite" className="text-xs text-destructive">
          Copy was unavailable. Select the code manually.
        </span>
      )}
    </div>
  );
}

function OnlineConnectionState({
  message,
  detail,
  hint,
  cancelLabel,
  onCancel,
}: {
  message: string;
  detail?: string;
  /** Overrides the room-flavoured default. A Quick Match has no room to change. */
  hint?: string;
  cancelLabel?: string;
  onCancel: () => void;
}) {
  return (
    <div className="glass flex flex-col items-center gap-2 p-4">
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
      >
        <Loader2 className="size-4 animate-spin text-[rgb(var(--player-color))]" aria-hidden="true" />
        {message}
      </span>
      {detail && (
        <p role="status" aria-live="polite" className="text-[11px] leading-tight text-muted-foreground">
          {detail}
        </p>
      )}
      <p className="text-[11px] leading-tight text-muted-foreground">
        {hint ?? "You can return to setup if you want to choose a different room."}
      </p>
      <Button size="sm" variant="glass" onClick={onCancel}>
        {cancelLabel ?? "Back to setup"}
      </Button>
    </div>
  );
}
