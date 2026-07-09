"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  getOrCreateGuestIdentity,
  saveAccountIdentity,
} from "@/app/utils/identity/gameIdentity";

export function AuthSessionBridge() {
  const { data: session } = authClient.useSession();
  const claimGuestProfile = useMutation(api.profiles.claimGuestProfile);
  const handledUserId = useRef<string | null>(null);

  useEffect(() => {
    const user = session?.user;
    if (!user) {
      handledUserId.current = null;
      return;
    }
    if (handledUserId.current === user.id) return;
    handledUserId.current = user.id;

    (async () => {
      try {
        const guest = getOrCreateGuestIdentity();
        const profile = await claimGuestProfile({
          guestId: guest.guestId,
          displayName: user.name ?? undefined,
        });
        const identity = saveAccountIdentity({
          userId: user.id,
          profileId: profile._id,
          displayName: user.name ?? guest.displayName,
          claimedGuestId: guest.guestId,
        });
        window.dispatchEvent(
          new CustomEvent("ttt:account-identity", { detail: identity }),
        );
      } catch (err) {
        console.warn("Account claim failed", err);
        handledUserId.current = null;
      }
    })();
  }, [session, claimGuestProfile]);

  return null;
}
