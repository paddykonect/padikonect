"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "./auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="font-body text-sm text-body-text">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
