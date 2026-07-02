"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  DISPLAY_NAME_MIN_LENGTH,
  getOrCreateGuestIdentity,
  saveDisplayName,
} from "@/app/utils/identity/gameIdentity";

interface GuestProfileSyncProps {
  displayName: string;
}

export function GuestProfileSync({ displayName }: GuestProfileSyncProps) {
  const upsertGuestProfile = useMutation(api.profiles.upsertGuestProfile);

  useEffect(() => {
    const syncTimeout = window.setTimeout(() => {
      const trimmedDisplayName = displayName.trim();
      const identity =
        trimmedDisplayName.length >= DISPLAY_NAME_MIN_LENGTH
          ? saveDisplayName(trimmedDisplayName)
          : getOrCreateGuestIdentity();

      void upsertGuestProfile({
        guestId: identity.guestId,
        displayName: identity.displayName,
      }).catch((error) => {
        console.warn("Failed to sync guest profile", error);
      });
    }, 500);

    return () => window.clearTimeout(syncTimeout);
  }, [displayName, upsertGuestProfile]);

  return null;
}
