"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import * as authApi from "./api";
import { AuthSession, PublicUser } from "./types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: Status;
  user: PublicUser | null;
  accessToken: string | null;
  setSession: (session: AuthSession) => void;
  /** Swap in a new access token for the same user (e.g. after changing password). */
  replaceAccessToken: (token: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Access tokens live in memory only (never localStorage) — on load, try
  // the httpOnly refresh cookie to silently resume a session.
  useEffect(() => {
    authApi
      .refreshSession()
      .then((session) => {
        setAccessToken(session.accessToken);
        setUser(session.user);
        setStatus("authenticated");
      })
      .catch(() => setStatus("unauthenticated"));
  }, []);

  const setSession = useCallback((session: AuthSession) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const replaceAccessToken = useCallback((token: string) => setAccessToken(token), []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort — clear local state regardless of network/API failure.
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, accessToken, setSession, replaceAccessToken, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
