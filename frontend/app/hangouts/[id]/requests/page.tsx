"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventDetail, JoinRequest } from "@/features/events/types";
import { FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatDayTime, formatRelativeShort } from "@/lib/format/time";

// Figma "Request" (350:30926): the host's queue of join requests with
// inline Accept / Decline; tap a card for the full Request detail.
function RequestsContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [requests, setRequests] = useState<JoinRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([eventsApi.getEvent(accessToken, id), eventsApi.listJoinRequests(accessToken, id)])
      .then(([e, r]) => {
        setEvent(e);
        setRequests(r);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load requests."));
  }, [accessToken, id]);

  async function decide(userId: string, decision: "approve" | "decline") {
    if (!accessToken) return;
    setBusy(userId);
    setError(null);
    try {
      await eventsApi.decideJoinRequest(accessToken, id, userId, decision);
      setRequests((list) => list?.filter((r) => r.user.id !== userId) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!event || !requests) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;

  return (
    <FlowScreen largeTitle title="Hangout Request" subtitle={`${event.title} · ${formatDayTime(event.startAt)}`} backHref={`/hangouts/${id}`}>
      <p className="font-body text-[13px] font-medium text-heading">
        {requests.length === 0
          ? "No requests waiting right now."
          : `${requests.length} request${requests.length === 1 ? "" : "s"} waiting on your response`}
      </p>
      {requests.map((r) => {
        const name = r.user.displayName ?? "Padi";
        return (
          <article key={r.rsvpId} className="relative flex flex-col gap-3 rounded-2xl bg-card p-2">
            <div className="flex items-start gap-3 px-2 pt-2">
              <Avatar name={name} photoUrl={r.user.photoUrl} size={44} />
              <div className="min-w-0 flex-1">
                <Link href={`/hangouts/${id}/requests/${r.user.id}`} className="font-body text-[15px] font-bold text-heading after:absolute after:inset-0">
                  {name}
                </Link>
                <p className="truncate font-body text-sm text-heading">
                  {r.status === "WAITLISTED" ? "On the waitlist for " : "Wants to join "}
                  {event.title}
                </p>
              </div>
              <span className="font-body text-xs text-body-text">{formatRelativeShort(r.createdAt)}</span>
            </div>
            <div className="relative z-10 flex gap-2">
              <button
                type="button"
                disabled={busy === r.user.id}
                onClick={() => void decide(r.user.id, "decline")}
                className="h-[38px] flex-1 rounded-full border border-border bg-card font-body text-[13px] font-medium text-heading disabled:opacity-50"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={busy === r.user.id}
                onClick={() => void decide(r.user.id, "approve")}
                className="h-[38px] flex-1 rounded-full bg-accent font-body text-[13px] font-medium text-[#1b3b2b] disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </article>
        );
      })}
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </FlowScreen>
  );
}

export default function RequestsPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <RequestsContent />
      </RequireCountry>
    </RequireAuth>
  );
}
