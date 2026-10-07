"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EntryPass, EventDetail } from "@/features/events/types";
import { FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { CheckIcon } from "@/features/hangouts/components/icons";
import { directionsUrl } from "@/features/hangouts/places";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatDayTime } from "@/lib/format/time";

const LeafletMap = dynamic(() => import("@/features/home/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

const outlineButton = "flex h-[42px] flex-1 items-center justify-center rounded-full border border-border bg-card px-2 font-body text-[13px] font-bold text-heading";

// Figma "Hangout pass" (360:725): confirmation, where to go, and the entry
// QR the host scans at the door.
function PassContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [pass, setPass] = useState<EntryPass | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([eventsApi.getEvent(accessToken, id), eventsApi.getEntryPass(accessToken, id)])
      .then(([e, p]) => {
        setEvent(e);
        setPass(p);
        return QRCode.toDataURL(p.passCode, { margin: 1, width: 480, color: { dark: "#1b3b2b", light: "#ffffff" } });
      })
      .then(setQr)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your pass."));
  }, [accessToken, id]);

  if (!event || !pass) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;

  const hostName = event.host.displayName ?? "The host";
  const checkedIn = Boolean(pass.checkedInAt);

  return (
    <FlowScreen largeTitle title={event.title} subtitle={`${formatDayTime(event.startAt)} · ${event.addressText}`} backHref={`/hangouts/${id}`}>
      <section className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-white">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-[#1b3b2b]">
          <CheckIcon size={18} />
        </span>
        <div>
          <p className="font-body text-[15px] font-bold">{checkedIn ? "You're checked in!" : "You're confirmed!"}</p>
          <p className="font-body text-[13px] text-white/80">{pass.decisionNote ? `“${pass.decisionNote}” — ${hostName}` : `${hostName} accepted your request to join.`}</p>
        </div>
      </section>

      <section className="flex flex-col overflow-hidden rounded-2xl bg-card">
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
        <div className="flex items-center gap-3 p-3">
          <p className="flex-1 font-body text-sm font-bold leading-5 text-heading">{event.addressText}</p>
          <a
            href={directionsUrl(event.latitude, event.longitude)}
            target="_blank"
            rel="noreferrer"
            className="flex h-[38px] shrink-0 items-center rounded-full bg-accent px-4 font-body text-[13px] font-bold text-[#1b3b2b]"
          >
            Get directions
          </a>
        </div>
      </section>

      <div className="flex gap-2">
        {event.venue?.phone && (
          <a href={`tel:${event.venue.phone}`} className={outlineButton}>
            Book a reservation
          </a>
        )}
        <Link href={`/chats/direct/${event.host.id}`} className={outlineButton}>
          Request host&apos;s contact
        </Link>
      </div>

      <section className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5">
        <h2 className="font-body text-base font-bold text-heading">Your entry pass</h2>
        <div className="rounded-2xl bg-toggle-bg p-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img src={qr} alt={`Entry pass ${pass.passCode}`} className={`size-[176px] rounded-lg ${checkedIn ? "opacity-40" : ""}`} />
          ) : (
            <div className="size-[176px] animate-pulse rounded-lg bg-border-subtle" />
          )}
        </div>
        <p className="font-body text-base font-bold tracking-wide text-heading">{pass.passCode}</p>
        <p className="text-center font-body text-[13px] text-body-text">
          {checkedIn ? "Your host has checked you in. Enjoy the hangout!" : "Show this to your host at the door so they can verify you've arrived."}
        </p>
      </section>
    </FlowScreen>
  );
}

export default function HangoutPassPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <PassContent />
      </RequireCountry>
    </RequireAuth>
  );
}
