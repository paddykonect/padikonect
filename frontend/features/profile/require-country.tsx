"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getOwnProfile } from "./api";

// Country of residence is required: any page past the Country onboarding step
// sends the user back to /country until their profile has one. Must be used
// inside <RequireAuth> (needs the access token).
export function RequireCountry({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getOwnProfile(accessToken)
      .then((profile) => {
        if (cancelled) return;
        if (profile.country) setReady(true);
        else router.replace("/country");
      })
      // Don't lock the user out over a failed profile fetch — the API's own
      // errors surface on the page itself.
      .catch(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [accessToken, router]);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="font-body text-sm text-body-text">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
