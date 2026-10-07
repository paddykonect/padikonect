"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventDetail, JoinRequestDetail } from "@/features/events/types";
import { Card, CardLabel, FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { CalendarIcon, ClockIcon, PeopleIcon, PinIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format/time";

const NOTE_MAX = 150;

/** "2 hours ago", "5 mins ago" */
function ago(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Figma "Request detail" (360:581) merged with "Request details" + note
// (419:5235): who's asking, their message, and an optional note back.
function RequestDetailContent() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [request, setRequest] = useState<JoinRequestDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestedAgo, setRequestedAgo] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([eventsApi.getEvent(accessToken, id), eventsApi.getJoinRequest(accessToken, id, userId)])
      .then(([e, r]) => {
        setEvent(e);
        setRequest(r);
        setRequestedAgo(ago(r.createdAt));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this request."));
  }, [accessToken, id, userId]);

  async function decide(decision: "approve" | "decline") {
    if (!accessToken) return;
    setBusy(decision);
    setError(null);
    try {
      await eventsApi.decideJoinRequest(accessToken, id, userId, decision, note);
      router.replace(`/hangouts/${id}/requests`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  if (!event || !request) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;

  const name = request.user.displayName ?? "Padi";
  const firstName = name.split(/\s+/)[0];
  const pending = request.status === "REQUESTED" || request.status === "WAITLISTED";
  const meta = [
    `${request.user.mutualHangouts} mutual hangout${request.user.mutualHangouts === 1 ? "" : "s"}`,
    request.user.state,
    `Member since ${new Date(request.user.memberSince).getFullYear()}`,
  ].filter(Boolean);

  return (
    <FlowScreen
      title="Request detail"
      backHref={`/hangouts/${id}/requests`}
      footer={
        pending ? (
          <>
            <Button loading={busy === "approve"} disabled={busy !== null} onClick={() => void decide("approve")}>
              Accept Request
            </Button>
            <Button variant="text" loading={busy === "decline"} disabled={busy !== null} onClick={() => void decide("decline")}>
              Decline
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar name={name} photoUrl={request.user.photoUrl} size={76} />
        <h2 className="font-heading text-xl font-bold text-heading">{name}</h2>
        <p className="font-body text-[13px] text-body-text">{meta.join(" · ")}</p>
      </div>

      <Card className="gap-3">
        <CardLabel>Wants to join</CardLabel>
        <h3 className="font-body text-base font-bold text-heading">{event.title}</h3>
        <div className="flex flex-col gap-2 border-t border-divider pt-3 font-body text-sm text-heading">
          <p className="flex items-center gap-2.5">
            <CalendarIcon size={18} className="shrink-0" />
            {formatDateTime(event.startAt)}
          </p>
          <p className="flex items-center gap-2.5">
            <PinIcon size={18} className="shrink-0" />
            {event.addressText}
          </p>
          <p className="flex items-center gap-2.5">
            <PeopleIcon size={18} className="shrink-0" />
            {event.capacity} padis capacity ({event.attendeeCount} joined)
          </p>
        </div>
      </Card>

      {request.message && (
        <Card className="gap-1.5">
          <CardLabel>Message from {firstName}</CardLabel>
          <p className="font-body text-sm leading-5 text-heading">{request.message}</p>
        </Card>
      )}

      <p className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 font-body text-sm text-heading">
        <ClockIcon size={18} />
        Requested {requestedAgo}
      </p>

      {pending ? (
        <label className="flex flex-col gap-2">
          <span className="flex justify-between font-body text-sm">
            <span className="font-medium text-heading">Add a note (optional)</span>
            <span className="text-body-text">
              {note.length}/{NOTE_MAX}
            </span>
          </span>
          <textarea
            value={note}
            maxLength={NOTE_MAX}
            rows={4}
            onChange={(e) => setNote(e.target.value)}
            placeholder={`e.g. See you there, ${firstName}!`}
            className="resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] leading-[22px] text-input-text outline-none placeholder:text-body-text"
          />
          <span className="font-body text-xs text-body-text">This note will be sent directly to {firstName} with the decision.</span>
        </label>
      ) : (
        <p className="text-center font-body text-sm text-body-text">
          {request.status === "DECLINED" ? "You declined this request." : request.status === "CANCELLED" ? `${firstName} cancelled this request.` : `${firstName} is going.`}
        </p>
      )}
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </FlowScreen>
  );
}

export default function RequestDetailPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <RequestDetailContent />
      </RequireCountry>
    </RequireAuth>
  );
}
