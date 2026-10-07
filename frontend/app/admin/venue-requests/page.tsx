"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { VenueRequest } from "@/features/events/types";
import { FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { PhoneIcon } from "@/features/hangouts/components/icons";
import { ApiError } from "@/lib/api/client";
import { formatPhone } from "@/lib/format/phone";
import { formatDateTime, formatRelativeShort } from "@/lib/format/time";

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: "bg-ink text-white",
  REJECTED: "bg-[#fdf1f0] text-[#8c1d18]",
};

function RequestCard({ request, onDecided }: { request: VenueRequest; onDecided: (r: VenueRequest) => void }) {
  const { accessToken } = useAuth();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = request.venueApproval === "PENDING";

  async function decide(decision: "CONFIRMED" | "REJECTED") {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await eventsApi.respondForVenue(accessToken, request.eventId, decision, decision === "REJECTED" ? note : undefined);
      onDecided({ ...request, venueApproval: decision, venueNote: decision === "REJECTED" ? note.trim() || null : null, venueRespondedAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">{request.venue.name}</p>
          <Link href={`/hangouts/${request.eventId}`} className="font-body text-base font-bold text-heading underline-offset-2 hover:underline">
            {request.title}
          </Link>
        </div>
        {pending ? (
          request.venueRequestedAt && <span className="shrink-0 font-body text-xs text-body-text">{formatRelativeShort(request.venueRequestedAt)}</span>
        ) : (
          <span className={`shrink-0 rounded-full px-2.5 py-1 font-body text-xs font-bold ${STATUS_PILL[request.venueApproval] ?? ""}`}>
            {request.venueApproval === "CONFIRMED" ? "Confirmed" : "Declined"}
          </span>
        )}
      </div>
      <p className="font-body text-[13px] text-body-text">
        {formatDateTime(request.startAt)} · {request.capacity} padis
      </p>
      <div className="flex items-center gap-2">
        <Avatar name={request.host.displayName ?? "Host"} photoUrl={request.host.photoUrl} size={28} />
        <span className="flex-1 font-body text-[13px] text-heading">Hosted by {request.host.displayName ?? "a padi"}</span>
        {request.venue.phone && (
          <a href={`tel:${request.venue.phone}`} className="flex items-center gap-1 font-body text-xs text-heading" aria-label={`Call ${request.venue.name}`}>
            <PhoneIcon size={14} />
            {formatPhone(request.venue.phone)}
          </a>
        )}
      </div>
      {!pending && request.venueNote && <p className="font-body text-[13px] italic text-body-text">&ldquo;{request.venueNote}&rdquo;</p>}
      {pending && declining && (
        <textarea
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note for the host (optional), e.g. fully booked that night"
          className="resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-sm text-input-text outline-none placeholder:text-body-text"
        />
      )}
      {pending && (
        <div className="flex gap-2">
          {declining ? (
            <>
              <button type="button" disabled={busy} onClick={() => setDeclining(false)} className="h-10 flex-1 rounded-full border border-border font-body text-[13px] font-medium text-heading">
                Back
              </button>
              <button type="button" disabled={busy} onClick={() => void decide("REJECTED")} className="h-10 flex-1 rounded-full bg-[#b3261e] font-body text-[13px] font-bold text-white disabled:opacity-60">
                {busy ? "Sending…" : "Send decline"}
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => setDeclining(true)} className="h-10 flex-1 rounded-full border border-border font-body text-[13px] font-medium text-heading">
                Decline
              </button>
              <button type="button" disabled={busy} onClick={() => void decide("CONFIRMED")} className="h-10 flex-1 rounded-full bg-accent font-body text-[13px] font-bold text-[#1b3b2b] disabled:opacity-60">
                {busy ? "Confirming…" : "Confirm"}
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </article>
  );
}

// Admin tool (not in Figma): venues have no accounts yet, so admins answer
// "Confirm with venue" requests on their behalf.
function VenueRequestsContent() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [requests, setRequests] = useState<VenueRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || user?.role !== "ADMIN") return;
    eventsApi
      .listVenueRequests(accessToken)
      .then(setRequests)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load venue requests."));
  }, [accessToken, user?.role]);

  if (user && user.role !== "ADMIN") return <ScreenMessage text="This page is for Padikonect admins." onBack={() => router.back()} />;
  if (!requests) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;

  const pending = requests.filter((r) => r.venueApproval === "PENDING");
  const decided = requests.filter((r) => r.venueApproval !== "PENDING");
  const update = (r: VenueRequest) => setRequests((list) => list?.map((x) => (x.eventId === r.eventId ? r : x)) ?? null);

  return (
    <FlowScreen largeTitle title="Venue requests" subtitle="Answer on behalf of venues until they have their own accounts." backHref="/settings">
      <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">Waiting ({pending.length})</h2>
      {pending.length === 0 && <p className="font-body text-sm text-body-text">Nothing waiting. 🎉</p>}
      {pending.map((r) => (
        <RequestCard key={r.eventId} request={r} onDecided={update} />
      ))}
      {decided.length > 0 && (
        <>
          <h2 className="pt-2 font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">Recent decisions</h2>
          {decided.map((r) => (
            <RequestCard key={r.eventId} request={r} onDecided={update} />
          ))}
        </>
      )}
    </FlowScreen>
  );
}

export default function VenueRequestsPage() {
  return (
    <RequireAuth>
      <VenueRequestsContent />
    </RequireAuth>
  );
}
