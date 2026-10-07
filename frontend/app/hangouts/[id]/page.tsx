"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventDetail, EventPerson } from "@/features/events/types";
import { ScanIcon, TicketIcon } from "@/features/hangouts/components/icons";
import { directionsUrl, goingLabel } from "@/features/hangouts/places";
import * as padisApi from "@/features/padis/api";
import { PadiUser } from "@/features/padis/types";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format/time";

const LeafletMap = dynamic(() => import("@/features/home/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

const roundButton = "flex size-9 items-center justify-center rounded-full bg-card";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** The button under the description, by the viewer's RSVP state. */
function joinAction(event: EventDetail): { label: string; kind: "join" | "leave" | "none"; note?: string } {
  if (event.status === "CANCELLED") return { label: "Hangout cancelled", kind: "none", note: event.cancelReason ?? undefined };
  if (event.isEnded) return { label: "This hangout has ended", kind: "none" };
  switch (event.myRsvpStatus) {
    case "REQUESTED":
      return { label: "Cancel request", kind: "leave", note: "Request sent. The host will let you know." };
    case "WAITLISTED":
      return { label: "Leave waitlist", kind: "leave", note: "It's full right now, so you're on the waitlist." };
    case "APPROVED":
    case "ATTENDED":
      return { label: "Leave hangout", kind: "leave", note: "You're going 🎉" };
    case "DECLINED":
      return { label: "Request declined", kind: "none" };
    default:
      return { label: "Request to join", kind: "join" };
  }
}

// Figma "Hangout detail user" (304:30259) and "Hangout detail Host"
// (304:30559): the host sees pending requests and "Invite padis" instead of
// the join button.
function HangoutDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [padis, setPadis] = useState<PadiUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [attendees, setAttendees] = useState<EventPerson[] | null>(null);
  const [attendeesError, setAttendeesError] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    eventsApi
      .getEvent(accessToken, id)
      .then((e) => {
        setEvent(e);
        if (e.isHost) padisApi.listPadis(accessToken).then(setPadis).catch(() => undefined);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this hangout."));
  }, [accessToken, id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast("Couldn't copy. Please try again.");
    }
  }

  async function share() {
    if (!event) return;
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: event.title, url }).catch(() => undefined);
    } else {
      await copy(url, "Link copied");
    }
  }

  async function act(kind: "join" | "leave") {
    if (!accessToken || !event) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "join") {
        await eventsApi.joinEvent(accessToken, event.id, joinMessage.trim() || undefined);
        setJoinOpen(false);
        setJoinMessage("");
      } else await eventsApi.leaveEvent(accessToken, event.id);
      // Reload so counts, the avatar stack and the status all line up.
      setEvent(await eventsApi.getEvent(accessToken, event.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openAttendees() {
    if (!accessToken || !event) return;
    setAttendeesOpen(true);
    setAttendeesError(false);
    try {
      setAttendees(await eventsApi.listAttendees(accessToken, event.id));
    } catch {
      setAttendeesError(true);
    }
  }

  async function cancelHangout() {
    if (!accessToken || !event) return;
    setBusy(true);
    setError(null);
    try {
      await eventsApi.cancelEvent(accessToken, event.id, cancelReason);
      setCancelOpen(false);
      setEvent(await eventsApi.getEvent(accessToken, event.id));
      setToast("Hangout cancelled. Guests have been told.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!event) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-background px-5">
        <p className="font-body text-sm text-body-text">{error ?? "Loading…"}</p>
        {error && (
          <button type="button" onClick={() => router.back()} className="font-body text-sm font-bold text-heading underline">
            Go back
          </button>
        )}
      </div>
    );
  }

  const hostName = event.host.displayName ?? "a padi";
  const action = joinAction(event);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background pb-8">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
        <button type="button" onClick={() => router.back()} aria-label="Back" className={roundButton}>
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} />
        </button>
        <button type="button" onClick={() => void share()} aria-label="Share hangout" className={roundButton}>
          <Image src="/icons/hangout/share.svg" alt="" width={16} height={16} />
        </button>
      </div>

      <div className="relative h-[348px] w-full shrink-0 bg-[#eef3e9]">
        {event.coverImageUrl ? (
          <Image src={event.coverImageUrl} alt="" fill sizes="430px" className="object-cover" unoptimized priority />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-6xl" aria-hidden>
            🎉
          </span>
        )}
      </div>

      <main className="flex flex-col gap-5 px-5 pt-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-bold leading-7 text-heading">{event.title}</h1>
          <Link href={`/padi/${event.host.id}`} className="flex items-center gap-2 self-start">
            {event.host.photoUrl ? (
              <Avatar name={hostName} photoUrl={event.host.photoUrl} size={32} />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-[rgba(215,230,0,0.35)] font-body text-xs font-medium leading-4 text-heading">
                {initials(hostName)}
              </span>
            )}
            <span className="font-body text-[13px] leading-[18px] text-body-text">{event.isHost ? "Hosted by you" : `Hosted by ${hostName}`}</span>
          </Link>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-card p-3">
          <p className="flex items-center gap-2.5 font-body text-sm leading-5 text-heading">
            <Image src="/icons/hangout/calendar18.svg" alt="" width={18} height={18} className="shrink-0" />
            {formatDateTime(event.startAt)}
          </p>
          {event.venue ? (
            <Link href={`/venues/${event.venue.id}`} className="flex items-center gap-2.5 font-body text-sm leading-5 text-heading underline-offset-2 hover:underline">
              <Image src="/icons/notif-location.svg" alt="" width={18} height={18} className="dark-invert shrink-0" />
              {event.addressText}
            </Link>
          ) : (
            <p className="flex items-center gap-2.5 font-body text-sm leading-5 text-heading">
              <Image src="/icons/notif-location.svg" alt="" width={18} height={18} className="dark-invert shrink-0" />
              {event.addressText}
            </p>
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl bg-card">
          <div className="relative isolate h-[175px] w-full">
            <LeafletMap
              center={[event.latitude, event.longitude]}
              pins={[{ id: event.id, latitude: event.latitude, longitude: event.longitude, emoji: "", dot: true, label: event.addressText }]}
              selectedId={null}
              onSelect={() => undefined}
              resizeKey={0}
              interactive={false}
            />
          </div>
          <div className="flex items-center gap-2 p-3">
            <a
              href={directionsUrl(event.latitude, event.longitude)}
              target="_blank"
              rel="noreferrer"
              className="flex h-[42px] flex-1 items-center justify-center gap-[7px] rounded-full bg-accent font-body text-[13px] font-bold leading-[18px] text-[#1b3b2b]"
            >
              <Image src="/icons/hangout/send.svg" alt="" width={22} height={22} />
              Get directions
            </a>
            <button
              type="button"
              onClick={() => void copy(event.addressText, "Address copied")}
              aria-label="Copy address"
              className="flex size-[42px] shrink-0 items-center justify-center rounded-full border border-border-subtle bg-card"
            >
              <Image src="/icons/hangout/copy.svg" alt="" width={16} height={16} />
            </button>
          </div>
        </div>

        <div className="relative flex items-center gap-2">
          {/* The avatars + count open the full guest list. */}
          {event.attendeeCount > 0 && (
            <button type="button" onClick={() => void openAttendees()} aria-label="See who's going" className="absolute inset-y-0 left-0 right-32 z-0" />
          )}
          {event.attendeePreview.length > 0 && (
            <div className="flex">
              {event.attendeePreview.map((p, i) => (
                <span key={p.id} className={`rounded-full border-2 border-background ${i > 0 ? "-ml-2" : ""}`}>
                  <Avatar name={p.displayName ?? "Padi"} photoUrl={p.photoUrl} size={28} />
                </span>
              ))}
            </div>
          )}
          <p className="flex-1 font-body text-[13px] leading-[18px] text-body-text">{goingLabel(event)}</p>
          {event.isHost && event.pendingRequestCount > 0 && (
            <Link
              href={`/hangouts/${event.id}/requests`}
              className="flex h-[37px] items-center rounded-full border-2 border-ink bg-ink px-4 font-body text-[13px] font-bold text-white"
            >
              {event.pendingRequestCount} request{event.pendingRequestCount === 1 ? "" : "s"}
            </Link>
          )}
        </div>

        {event.description && <p className="whitespace-pre-line font-body text-sm leading-5 text-heading">{event.description}</p>}

        {error && <p className="font-body text-sm text-danger">{error}</p>}

        {event.isHost && event.status !== "CANCELLED" && (event.venueApproval === "PENDING" || event.venueApproval === "REJECTED") && event.venue && (
          <Link
            href={`/hangouts/${event.id}/venue`}
            className={`rounded-2xl px-4 py-3 font-body text-[13px] leading-[18px] ${
              event.venueApproval === "REJECTED" ? "border border-[#f5c2c0] bg-[#fdf1f0] text-[#8c1d18]" : "bg-toggle-bg text-heading"
            }`}
          >
            {event.venueApproval === "REJECTED"
              ? `${event.venue.name} declined this hangout. Tap to modify your request.`
              : event.venueRequestedAt
                ? `Waiting for ${event.venue.name} to confirm. Only you can see this hangout until then.`
                : `${event.venue.name} needs to confirm before this goes live. Tap to send the request.`}
          </Link>
        )}

        {event.isHost ? (
          <section className="flex flex-col gap-2.5">
            <h2 className="font-heading text-2xl font-bold leading-8 text-heading">Invite padis</h2>
            <div className="flex flex-wrap gap-2.5">
              {padis.slice(0, 6).map((p) => (
                <Link key={p.id} href={`/padi/${p.id}`} aria-label={p.displayName}>
                  <Avatar name={p.displayName} photoUrl={p.photoUrl} size={40} />
                </Link>
              ))}
              <Link
                href={`/hangouts/${event.id}/invite`}
                aria-label="Invite padis"
                className="flex size-[42px] items-center justify-center rounded-full border border-dashed border-body-text p-px"
              >
                <Image src="/icons/hangout/invite.svg" alt="" width={16} height={16} />
              </Link>
            </div>
            {!event.isEnded && event.status !== "CANCELLED" && (
              <Link
                href={`/hangouts/${event.id}/scan`}
                className="mt-2 flex h-[48px] items-center justify-center gap-2 rounded-full border border-border bg-card font-body text-sm font-bold text-heading"
              >
                <ScanIcon size={18} />
                Scan entry passes
              </Link>
            )}
            {event.status !== "CANCELLED" && !event.isEnded && (
              <button type="button" onClick={() => setCancelOpen(true)} className="mt-1 py-2 font-body text-sm font-medium text-danger">
                Cancel hangout
              </button>
            )}
            {event.status === "CANCELLED" && <p className="text-center font-body text-[13px] text-body-text">You cancelled this hangout.</p>}
          </section>
        ) : (
          <div className="flex flex-col gap-2">
            {action.note && <p className="text-center font-body text-[13px] text-body-text">{action.note}</p>}
            {(event.myRsvpStatus === "APPROVED" || event.myRsvpStatus === "ATTENDED") && (
              <Link
                href={`/hangouts/${event.id}/pass`}
                className="flex h-[52px] items-center justify-center gap-2 rounded-pill bg-primary font-body text-sm font-bold text-primary-foreground"
              >
                <TicketIcon size={18} />
                View entry pass
              </Link>
            )}
            {action.kind === "none" ? (
              <Button disabled>{action.label}</Button>
            ) : (
              <Button
                variant={action.kind === "join" ? "primary" : "text"}
                loading={busy}
                onClick={() => (action.kind === "join" ? setJoinOpen(true) : void act("leave"))}
                className={action.kind === "leave" ? "border border-border" : ""}
              >
                {action.label}
              </Button>
            )}
          </div>
        )}
      </main>

      <BottomSheet open={attendeesOpen} onClose={() => setAttendeesOpen(false)} title={`Going (${event.attendeeCount})`}>
        <div className="flex max-h-[50dvh] flex-col overflow-y-auto">
          {attendeesError ? (
            <p className="py-3 font-body text-sm text-danger">Couldn&apos;t load the guest list. Please try again.</p>
          ) : (
            attendees === null && <p className="py-3 font-body text-sm text-body-text">Loading…</p>
          )}
          {!attendeesError && attendees?.length === 0 && <p className="py-3 font-body text-sm text-body-text">No one yet.</p>}
          {attendees?.map((p) => (
            <Link key={p.id} href={`/padi/${p.id}`} className="flex items-center gap-3 py-2.5">
              <Avatar name={p.displayName ?? "Padi"} photoUrl={p.photoUrl} size={40} />
              <span className="font-body text-sm font-medium text-heading">{p.displayName ?? "Padi"}</span>
            </Link>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this hangout?" description="Everyone who joined or asked to join will be notified.">
        <div className="flex flex-col gap-3">
          <textarea
            value={cancelReason}
            maxLength={500}
            rows={3}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason (optional), e.g. the venue closed early"
            className="resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text"
          />
          {error && <p className="font-body text-sm text-danger">{error}</p>}
          <Button loading={busy} onClick={() => void cancelHangout()} className="!bg-[#b3261e] !text-white">
            Cancel hangout
          </Button>
          <Button variant="text" onClick={() => setCancelOpen(false)}>
            Keep it
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={joinOpen} onClose={() => setJoinOpen(false)} title="Request to join" description={`${hostName} will see your request.`}>
        <div className="flex flex-col gap-3">
          <textarea
            value={joinMessage}
            maxLength={280}
            rows={3}
            onChange={(e) => setJoinMessage(e.target.value)}
            placeholder="Add a message for the host (optional)"
            className="resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text"
          />
          {error && <p className="font-body text-sm text-danger">{error}</p>}
          <Button loading={busy} onClick={() => void act("join")}>
            Send request
          </Button>
        </div>
      </BottomSheet>

      <p aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center">
        {toast && <span className="rounded-full bg-ink px-4 py-2 font-body text-[13px] text-white shadow-lg">{toast}</span>}
      </p>
    </div>
  );
}

export default function HangoutDetailPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <HangoutDetailContent />
      </RequireCountry>
    </RequireAuth>
  );
}
