"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as settingsApi from "@/features/settings/api";
import { BlockedUser } from "@/features/settings/api";
import { SettingsScreen, initialsOf } from "@/features/settings/components";
import { ApiError } from "@/lib/api/client";

/** "2 weeks ago", "1 month ago". */
function ago(iso: string, now = Date.now()) {
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m === 1 ? "" : "s"} ago`;
  }
  const y = Math.floor(days / 365);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

// Figma "Blocked padis" (301:5056).
function BlockedContent() {
  const { accessToken } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    settingsApi
      .listBlocked(accessToken)
      .then(setBlocked)
      .catch(() => setError("Couldn't load blocked padis."));
  }, [accessToken]);

  async function unblock(userId: string) {
    if (!accessToken) return;
    setBusyId(userId);
    setError(null);
    try {
      await settingsApi.unblockUser(accessToken, userId);
      setBlocked((list) => list?.filter((b) => b.user.id !== userId) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't unblock. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SettingsScreen title="Blocked padis">
      <p className="font-body text-sm leading-5 text-body-text">Blocked padis can&apos;t invite you, message you or see your hangouts.</p>
      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {blocked && blocked.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-2xl bg-card [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-divider">
          {blocked.map(({ user, blockedAt }) => (
            <li key={user.id} className="flex items-center gap-3 p-3.5">
              {user.photoUrl ? (
                <Avatar name={user.displayName} photoUrl={user.photoUrl} size={40} />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-border-subtle font-body text-[13px] font-bold text-[#1b3b2b]">
                  {initialsOf(user.displayName)}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-body text-sm text-heading">{user.displayName}</span>
                <span className="font-body text-[12.5px] text-body-text">Blocked {ago(blockedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => void unblock(user.id)}
                disabled={busyId === user.id}
                className="flex h-[34px] shrink-0 items-center rounded-full border border-border bg-card px-[15px] font-body text-[12.5px] font-medium text-heading disabled:opacity-60"
              >
                {busyId === user.id ? "Unblocking…" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {blocked?.length === 0 && (
        <p className="rounded-2xl bg-card p-4 text-center font-body text-[13px] text-body-text">
          You haven&apos;t blocked anyone. You can block someone from their profile.
        </p>
      )}
    </SettingsScreen>
  );
}

export default function BlockedPage() {
  return (
    <RequireAuth>
      <BlockedContent />
    </RequireAuth>
  );
}
