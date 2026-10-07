"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventDetail } from "@/features/events/types";
import { Card, CardLabel, FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { ChatIcon, CheckIcon, ChevronRightIcon, PhoneIcon, XCircleIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { VENUE_CATEGORY_EMOJI, VENUE_CATEGORY_LABEL } from "@/features/venues/types";
import { ApiError } from "@/lib/api/client";
import { formatPhone } from "@/lib/format/phone";
import { formatDateTime } from "@/lib/format/time";

const POLL_MS = 5000;

/** mm:ss since the request went out. */
function useElapsed(since: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return "0:00";
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function HangoutSummary({ event }: { event: EventDetail }) {
  return (
    <Card className="gap-1.5">
      <h2 className="font-body text-base font-bold text-heading">{event.title}</h2>
      <p className="font-body text-[13px] text-body-text">{formatDateTime(event.startAt)}</p>
      <p className="font-body text-[13px] text-body-text">{event.venue ? `${event.venue.name} · ${event.venue.addressText}` : event.addressText}</p>
      <p className="font-body text-[13px] text-body-text">{event.capacity} padis capacity</p>
    </Card>
  );
}

function StatusBadge({ tone, children }: { tone: "ink" | "danger"; children: React.ReactNode }) {
  return (
    <span className={`flex size-[78px] items-center justify-center rounded-full ${tone === "ink" ? "bg-ink text-accent" : "bg-[#b3261e] text-white"}`}>{children}</span>
  );
}

// Figma "Confirm with venue" (406:4046), "Waiting for venue" (406:4161),
// "Venue confirmed" (406:4249) and "Venue rejected" (407:4309) — one route,
// driven by the hangout's venueApproval.
function VenueFlowContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    if (!accessToken) return;
    eventsApi
      .getEvent(accessToken, id)
      .then(setEvent)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this hangout."));
  }, [accessToken, id]);

  useEffect(load, [load]);

  const waiting = event?.venueApproval === "PENDING" && Boolean(event.venueRequestedAt);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, load]);

  const elapsed = useElapsed(waiting ? (event?.venueRequestedAt ?? null) : null);

  async function sendRequest() {
    if (!accessToken || !event) return;
    setSending(true);
    setError(null);
    try {
      const { venueRequestedAt } = await eventsApi.requestVenueConfirmation(accessToken, event.id);
      setEvent({ ...event, venueRequestedAt });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the venue. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (!event) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;
  const venue = event.venue;
  if (!venue || !event.isHost || event.venueApproval === "NOT_REQUIRED") {
    return <ScreenMessage text="This hangout doesn't need venue confirmation." onBack={() => router.replace(`/hangouts/${event.id}`)} />;
  }

  if (event.venueApproval === "CONFIRMED") {
    return (
      <FlowScreen backHref={`/hangouts/${event.id}`} footer={<Button onClick={() => router.replace(`/hangouts/${event.id}`)}>View hangout</Button>}>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <StatusBadge tone="ink">
            <CheckIcon size={30} />
          </StatusBadge>
          <h1 className="font-heading text-2xl font-bold leading-9 text-heading">{venue.name} confirmed your hangout!</h1>
          <p className="font-body text-sm text-body-text">You&apos;re all set. Your hangout is now live for padis to see.</p>
          <div className="w-full text-left">
            <HangoutSummary event={event} />
          </div>
        </div>
      </FlowScreen>
    );
  }

  if (event.venueApproval === "REJECTED") {
    return (
      <FlowScreen
        title="Request declined"
        backHref={`/hangouts/${event.id}`}
        footer={<Button onClick={() => router.push(`/hangouts/new?edit=${event.id}`)}>Modify Request</Button>}
      >
        <div className="flex flex-col items-center gap-5 pt-6 text-center">
          <StatusBadge tone="danger">
            <XCircleIcon size={30} />
          </StatusBadge>
          <h1 className="font-heading text-2xl font-bold leading-9 text-heading">{venue.name} rejected your hangout request</h1>
          <p className="font-body text-sm text-body-text">Unfortunately, the venue was unable to accommodate your request.</p>
        </div>
        <HangoutSummary event={event} />
        {event.venueNote && (
          <section className="flex flex-col gap-2 rounded-2xl border border-[#f5c2c0] bg-[#fdf1f0] p-4">
            <h2 className="flex items-center gap-2 font-body text-sm font-bold text-[#8c1d18]">
              <span className="flex size-6 items-center justify-center rounded-full bg-[#f9d7d5]">
                <ChatIcon size={14} />
              </span>
              Note from venue
            </h2>
            <p className="font-body text-sm leading-5 text-[#8c1d18]">&ldquo;{event.venueNote}&rdquo;</p>
          </section>
        )}
      </FlowScreen>
    );
  }

  if (waiting) {
    return (
      <FlowScreen title="Request sent" backHref={`/hangouts/${event.id}`}>
        <div className="flex flex-col items-center gap-5 pt-4 text-center">
          <StatusBadge tone="ink">
            <ChatIcon size={30} />
          </StatusBadge>
          <h1 className="font-heading text-xl font-bold text-heading">Waiting for {venue.name}</h1>
          <p className="max-w-[300px] font-body text-sm text-body-text">We&apos;ve sent your hangout details. We&apos;ll notify you the moment they respond.</p>
          <span className="rounded-full border border-border bg-card px-5 py-2.5 font-body text-sm font-bold tabular-nums text-heading" aria-label="Time since request">
            {elapsed}
          </span>
          <Link href={`/hangouts/${event.id}`} className="font-body text-[13px] text-heading underline">
            Go to hangout
          </Link>
        </div>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen title="Confirm with venue" backHref={`/hangouts/${event.id}`}>
      <p className="font-body text-sm leading-5 text-body-text">
        Public venues need to confirm they can host before your hangout goes live. Choose how you&apos;d like to reach them.
      </p>
      <Card className="flex-row items-center gap-3">
        <span className="relative flex size-[62px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eef3e9] text-2xl">
          {venue.coverImageUrl ? <Image src={venue.coverImageUrl} alt="" fill sizes="62px" className="object-cover" unoptimized /> : VENUE_CATEGORY_EMOJI[venue.category]}
        </span>
        <div className="min-w-0">
          <p className="font-body text-base font-bold text-heading">{venue.name}</p>
          <p className="truncate font-body text-[13px] text-body-text">
            {VENUE_CATEGORY_LABEL[venue.category]} · {venue.addressText}
          </p>
        </div>
      </Card>
      <Card className="gap-2">
        <CardLabel>Your request</CardLabel>
        {[
          ["Hangout", event.title],
          ["Date & time", formatDateTime(event.startAt)],
          ["Guests", `${event.capacity} padis`],
        ].map(([k, v]) => (
          <p key={k} className="flex justify-between gap-4 font-body text-sm">
            <span className="text-body-text">{k}</span>
            <span className="text-right font-medium text-heading">{v}</span>
          </p>
        ))}
      </Card>
      <button
        type="button"
        onClick={() => void sendRequest()}
        disabled={sending}
        className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-left text-white disabled:opacity-60"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(215,230,0,0.18)] text-accent">
          <ChatIcon size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-body text-[15px] font-bold">{sending ? "Sending…" : "Send in-app message"}</span>
          <span className="block font-body text-[13px] text-white/75">We&apos;ll notify the venue and update you here</span>
        </span>
        <ChevronRightIcon size={18} />
      </button>
      {venue.phone && (
        <a href={`tel:${venue.phone}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef3e9] text-heading">
            <PhoneIcon size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-body text-[15px] font-bold text-heading">Call the venue directly</span>
            <span className="block font-body text-[13px] text-body-text">{formatPhone(venue.phone)} · Opens your dialer</span>
          </span>
        </a>
      )}
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </FlowScreen>
  );
}

export default function VenueFlowPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <VenueFlowContent />
      </RequireCountry>
    </RequireAuth>
  );
}
