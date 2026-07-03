import { Cloud, HardDrive, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameIdentity } from "@/app/types/types";
import { cn } from "@/lib/utils";

interface AccountStatusProps {
  displayName: string;
  identityKind: GameIdentity["kind"];
  durableProfileEnabled: boolean;
  googleSignInEnabled?: boolean;
  onGoogleSignIn?: () => void;
  className?: string;
}

export function AccountStatus({
  displayName,
  identityKind,
  durableProfileEnabled,
  googleSignInEnabled = false,
  onGoogleSignIn,
  className,
}: AccountStatusProps) {
  const SyncIcon = durableProfileEnabled ? Cloud : HardDrive;
  const identityLabel = identityKind === "account" ? "Account" : "Guest";
  const syncLabel = durableProfileEnabled ? "Synced" : "Local";

  return (
    <div className={cn("flex items-center justify-between gap-2 rounded-lg border bg-background/50 px-3 py-2", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{displayName || "Guest"}</span>
            <span className="rounded border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {identityLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <SyncIcon className="h-3 w-3" />
            <span>{syncLabel}</span>
          </div>
        </div>
      </div>
      {googleSignInEnabled && onGoogleSignIn && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onGoogleSignIn}
          className="h-8 shrink-0 px-2 text-xs"
        >
          Google
        </Button>
      )}
    </div>
  );
}
