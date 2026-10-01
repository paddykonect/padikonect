"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as notificationsApi from "@/features/notifications/api";
import { AppNotification } from "@/features/notifications/types";

// Figma node 304:28457 ("Notifications"), part of the much larger
// Home/Discover/Hangout canvas — only this one screen is in scope for now
// (see the user's explicit scope decision). Backend already existed (Phase 4
// notifications module); this wires it up for the first time.

function iconFor(type: AppNotification["type"]): string {
  switch (type) {
    case "EVENT_CANCELLED":
      return "/icons/notif-location.svg";
    case "EVENT_UPDATED":
    default:
      return "/icons/notif-invite.svg";
  }
}

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const unread = !notification.readAt;
  return (
    <button
      type="button"
      onClick={() => unread && onRead(notification.id)}
      className={`flex w-full items-start gap-3 border-b border-border-subtle px-3.5 py-3.5 text-left last:border-b-0 ${
        unread ? "bg-primary/10" : "bg-white"
      }`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
          unread ? "bg-primary/35" : "bg-border-subtle"
        }`}
      >
        <Image src={iconFor(notification.type)} alt="" width={18} height={18} />
      </span>
      <span className="flex-1">
        <span className={`block font-body text-sm ${unread ? "font-bold text-heading" : "font-normal text-heading"}`}>
          {notification.title}
        </span>
        <span className="mt-1 block font-body text-xs text-body-text">{relativeTime(notification.createdAt)}</span>
      </span>
      {unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}

function NotificationsContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await notificationsApi.listNotifications(accessToken);
      setNotifications(data);
    } catch {
      setError("Could not load notifications.");
    }
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a derived-state anti-pattern
    void load();
  }, [load]);

  async function handleRead(id: string) {
    if (!accessToken) return;
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? prev);
    try {
      await notificationsApi.markNotificationRead(accessToken, id);
    } catch {
      // Best-effort — local state already reflects it; a reload will reconcile.
    }
  }

  async function handleMarkAllRead() {
    if (!accessToken || !notifications) return;
    const unread = notifications.filter((n) => !n.readAt);
    if (unread.length === 0) return;
    setNotifications((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? prev);
    await Promise.allSettled(unread.map((n) => notificationsApi.markNotificationRead(accessToken, n.id)));
  }

  const today = notifications?.filter((n) => isToday(n.createdAt)) ?? [];
  const earlier = notifications?.filter((n) => !isToday(n.createdAt)) ?? [];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-full bg-white"
          aria-label="Back"
        >
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} />
        </button>
        <h1 className="flex-1 font-heading text-xl font-bold text-heading">Notifications</h1>
        <button type="button" onClick={() => void handleMarkAllRead()} className="font-body text-[13px] text-heading">
          Mark all read
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6">
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        {notifications === null && !error && <p className="font-body text-sm text-body-text">Loading…</p>}
        {notifications !== null && notifications.length === 0 && (
          <p className="py-10 text-center font-body text-sm text-body-text">No notifications yet.</p>
        )}

        {today.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-body text-[13px] font-bold uppercase tracking-wide text-body-text">Today</p>
            <div className="overflow-hidden rounded-2xl">
              {today.map((n) => (
                <NotificationRow key={n.id} notification={n} onRead={handleRead} />
              ))}
            </div>
          </div>
        )}

        {earlier.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="font-body text-[13px] font-bold uppercase tracking-wide text-body-text">Earlier</p>
            <div className="overflow-hidden rounded-2xl">
              {earlier.map((n) => (
                <NotificationRow key={n.id} notification={n} onRead={handleRead} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
