"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import * as notificationsApi from "./api";
import { AppNotification } from "./types";

/** Key in localStorage that tracks which notification IDs have been shown. */
const SHOWN_KEY = "pk_shown_notifs";

function getShown(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markShown(ids: string[]) {
  try {
    const existing = getShown();
    ids.forEach((id) => existing.add(id));
    // Keep only the 200 most recently seen IDs to avoid unbounded growth.
    const trimmed = [...existing].slice(-200);
    localStorage.setItem(SHOWN_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable — safe to ignore.
  }
}

/** Where tapping a notification popup navigates. Mirrors the notifications page. */
function hrefFor(n: AppNotification): string | null {
  const eventId = typeof n.data?.eventId === "string" ? n.data.eventId : null;
  const userId = typeof n.data?.userId === "string" ? n.data.userId : null;
  if (!eventId) return null;
  switch (n.type) {
    case "RSVP_REQUESTED":
      return userId
        ? `/hangouts/${eventId}/requests/${userId}`
        : `/hangouts/${eventId}/requests`;
    case "RSVP_APPROVED":
      return `/hangouts/${eventId}/pass`;
    case "VENUE_CONFIRMED":
    case "VENUE_REJECTED":
      return `/hangouts/${eventId}/venue`;
    case "VENUE_REQUEST":
      return "/admin/venue-requests";
    default:
      return `/hangouts/${eventId}`;
  }
}

function iconFor(type: AppNotification["type"]): string {
  switch (type) {
    case "EVENT_CANCELLED":
    case "VENUE_CONFIRMED":
    case "VENUE_REJECTED":
    case "VENUE_REQUEST":
      return "/icons/notif-location.svg";
    case "RSVP_REQUESTED":
      return "/icons/notif-request.svg";
    case "RSVP_APPROVED":
    case "RSVP_DECLINED":
      return "/icons/notif-person.svg";
    case "EVENT_UPDATED":
    case "EVENT_INVITE":
    default:
      return "/icons/notif-invite.svg";
  }
}

interface ToastItem {
  notification: AppNotification;
  visible: boolean;
}

/** Single sliding toast banner for one notification. */
function NotifToast({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const router = useRouter();
  const href = hrefFor(item.notification);

  function open() {
    onDismiss();
    if (href) router.push(href);
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-[390px] cursor-pointer items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.18)] ring-1 ring-border transition-all duration-500 ${
        item.visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
      }`}
      onClick={open}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/30">
        <Image
          src={iconFor(item.notification.type)}
          alt=""
          width={18}
          height={18}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-bold text-heading">
          {item.notification.title}
        </p>
        {item.notification.body && (
          <p className="mt-0.5 truncate font-body text-xs text-body-text">
            {item.notification.body}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-border text-heading hover:bg-border-subtle"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1 1l8 8M9 1L1 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Mount this once in your layout (inside AuthProvider). It silently polls for
 * unread notifications after the user is authenticated and pops up a banner
 * for each one that the user hasn't seen yet in this browser.
 */
export function NotificationBanner() {
  const { status, accessToken } = useAuth();
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const polledRef = useRef(false);

  const fetchAndQueue = useCallback(async () => {
    if (!accessToken) return;
    try {
      const all = await notificationsApi.listNotifications(accessToken);
      const shown = getShown();
      const fresh = all.filter((n) => !n.readAt && !shown.has(n.id));
      if (fresh.length === 0) return;

      markShown(fresh.map((n) => n.id));

      // Show up to 3 newest notifications; oldest-first so newest is on top.
      const toShow = fresh.slice(0, 3).reverse();
      setQueue((prev) => [
        ...prev,
        ...toShow.map((n) => ({ notification: n, visible: false })),
      ]);

      // Trigger the slide-in on the next paint so the CSS transition fires.
      requestAnimationFrame(() => {
        setTimeout(() => {
          setQueue((prev) =>
            prev.map((item) =>
              toShow.some((n) => n.id === item.notification.id)
                ? { ...item, visible: true }
                : item
            )
          );
        }, 50);
      });
    } catch {
      // Silent — notification errors should never break the app.
    }
  }, [accessToken]);

  // Fetch once when the user becomes authenticated (login / session restore).
  // Reset the guard on logout so the next login triggers a fresh fetch.
  useEffect(() => {
    if (status === "unauthenticated") {
      polledRef.current = false;
      return;
    }
    if (status === "authenticated" && !polledRef.current) {
      polledRef.current = true;
      void fetchAndQueue();
    }
  }, [status, fetchAndQueue]);

  // Auto-dismiss the oldest visible toast after 5 s.
  useEffect(() => {
    if (queue.length === 0) return;
    const visible = queue.filter((t) => t.visible);
    if (visible.length === 0) return;

    const oldest = visible[visible.length - 1];
    const timer = setTimeout(() => {
      setQueue((prev) =>
        prev.map((item) =>
          item.notification.id === oldest.notification.id
            ? { ...item, visible: false }
            : item
        )
      );
      // Remove from DOM after transition completes.
      setTimeout(() => {
        setQueue((prev) =>
          prev.filter(
            (item) => item.notification.id !== oldest.notification.id
          )
        );
      }, 500);
    }, 5000);
    return () => clearTimeout(timer);
  }, [queue]);

  function dismiss(id: string) {
    setQueue((prev) =>
      prev.map((item) =>
        item.notification.id === id ? { ...item, visible: false } : item
      )
    );
    setTimeout(() => {
      setQueue((prev) =>
        prev.filter((item) => item.notification.id !== id)
      );
    }, 500);
  }

  if (queue.length === 0) return null;

  return (
    <div
      aria-label="Notification banners"
      className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4"
    >
      {queue.map((item) => (
        <NotifToast
          key={item.notification.id}
          item={item}
          onDismiss={() => dismiss(item.notification.id)}
        />
      ))}
    </div>
  );
}
