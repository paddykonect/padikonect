"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventDetail, InviteCandidate } from "@/features/events/types";
import { FlowScreen, ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { CheckIcon, ChevronDownIcon, PencilIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { formatDayTime } from "@/lib/format/time";

function subtitle(c: InviteCandidate) {
  if (c.joined) return "Already joined";
  if (c.invited) return "Invited";
  if (c.mutualHangouts > 0) return `${c.mutualHangouts} mutual hangout${c.mutualHangouts === 1 ? "" : "s"}`;
  return c.state ?? "New padi";
}

function Row({ c, selected, onToggle }: { c: InviteCandidate; selected: boolean; onToggle: () => void }) {
  const locked = c.invited || c.joined;
  const name = c.displayName ?? "Padi";
  return (
    <button type="button" disabled={locked} onClick={onToggle} aria-pressed={selected} className="flex items-center gap-3 py-2 text-left disabled:opacity-60">
      <Avatar name={name} photoUrl={c.photoUrl} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[15px] text-heading">{name}</span>
        <span className="block font-body text-[13px] text-body-text">{subtitle(c)}</span>
      </span>
      <span
        className={`flex size-[30px] shrink-0 items-center justify-center rounded-full border ${
          selected || locked ? "border-ink bg-ink text-white" : "border-border bg-card"
        }`}
      >
        {(selected || locked) && <CheckIcon size={15} />}
      </span>
    </button>
  );
}

const sectionTitle = "pt-2 font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text";

// Figma "Invite padis" (360:1041): suggested padis (shared hangouts) first,
// then everyone else; share link at the bottom for people not on the app yet.
function InviteContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [candidates, setCandidates] = useState<InviteCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([eventsApi.getEvent(accessToken, id), eventsApi.listInviteCandidates(accessToken, id)])
      .then(([e, c]) => {
        setEvent(e);
        setCandidates(c);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load your padis."));
  }, [accessToken, id]);

  if (!event || !candidates) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;

  const suggested = candidates.filter((c) => c.mutualHangouts > 0);
  const others = candidates.filter((c) => c.mutualHangouts === 0);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/hangouts/${event.id}`;

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function send() {
    if (!accessToken || selected.size === 0) return;
    setSending(true);
    setError(null);
    try {
      await eventsApi.invitePadis(accessToken, id, [...selected]);
      router.replace(`/hangouts/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invites. Please try again.");
      setSending(false);
    }
  }

  async function shareLink() {
    if (navigator.share) {
      await navigator.share({ title: event!.title, url: link }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied");
    } catch {
      setMessage("Couldn't copy. Please try again.");
    }
  }

  return (
    <FlowScreen
      largeTitle
      title="Invite padis"
      subtitle={`To ${event.title} · ${formatDayTime(event.startAt)}`}
      backHref={`/hangouts/${id}`}
      action={
        <span className="font-body text-[13px] text-heading">
          {selected.size} padi{selected.size === 1 ? "" : "s"} selected
        </span>
      }
      footer={
        <Button disabled={selected.size === 0} loading={sending} onClick={() => void send()}>
          Invite ({selected.size})
        </Button>
      }
    >
      {event.pendingRequestCount > 0 && (
        <p className="font-body text-[13px] font-medium text-heading">
          {event.pendingRequestCount} request{event.pendingRequestCount === 1 ? "" : "s"} waiting on your response
        </p>
      )}
      {candidates.length === 0 && <p className="font-body text-sm text-body-text">No padis yet — scan a padi&apos;s code from Home to add them, or share the link below.</p>}
      {suggested.length > 0 && (
        <section className="flex flex-col">
          <h2 className={sectionTitle}>Suggested for this hangout</h2>
          {suggested.map((c) => (
            <Row key={c.id} c={c} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
        </section>
      )}
      {others.length > 0 && (
        <section className="flex flex-col">
          <h2 className={sectionTitle}>Your padis</h2>
          {others.map((c) => (
            <Row key={c.id} c={c} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
          ))}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <button type="button" onClick={() => setShareOpen((o) => !o)} aria-expanded={shareOpen} className="flex items-center gap-3 py-2 text-left">
          <span className="flex size-[44px] items-center justify-center rounded-full border border-dashed border-body-text text-heading">
            <PencilIcon size={16} />
          </span>
          <span className="flex-1 font-body text-[15px] text-heading">Invite by phone number or share link</span>
          <ChevronDownIcon size={16} className={`text-body-text transition-transform ${shareOpen ? "rotate-180" : ""}`} />
        </button>
        {shareOpen && (
          <div className="flex flex-col gap-2 rounded-2xl bg-card p-3">
            <p className="break-all font-body text-[13px] text-body-text">{link}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void shareLink()} className="h-10 flex-1 rounded-full bg-accent font-body text-[13px] font-bold text-[#1b3b2b]">
                Share link
              </button>
              <a
                href={`sms:?&body=${encodeURIComponent(`Join me at ${event.title}: ${link}`)}`}
                className="flex h-10 flex-1 items-center justify-center rounded-full border border-border font-body text-[13px] font-bold text-heading"
              >
                Send by SMS
              </a>
            </div>
          </div>
        )}
      </section>
      {message && <p className="font-body text-sm text-heading">{message}</p>}
      {error && <p className="font-body text-sm text-danger">{error}</p>}
    </FlowScreen>
  );
}

export default function InvitePadisPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <InviteContent />
      </RequireCountry>
    </RequireAuth>
  );
}
