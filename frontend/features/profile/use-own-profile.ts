"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getOwnProfile } from "./api";
import { OwnProfile } from "./types";

export function useOwnProfile() {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<OwnProfile | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setProfile(await getOwnProfile(accessToken));
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getOwnProfile(accessToken)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return { profile, setProfile, reload };
}

export function profileName(profile: OwnProfile | null, fallback = ""): string {
  return profile?.displayName || profile?.fullName || fallback;
}
