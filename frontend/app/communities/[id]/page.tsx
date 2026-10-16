"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as communitiesApi from "@/features/communities/api";
import { CommunityDetail, CommunityEvent, CommunityMember } from "@/features/communities/types";
import { ChatIcon, ChevronRightIcon, PlusIcon, TicketIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { ApiError } from "@/lib/api/client";
import { cloudinaryDisplayUrl } from "@/lib/media/cloudinary";
import { formatDayTime } from "@/lib/format/time";

type TabKey = "overview" | "members" | "events";

function joinedLabel(iso: string) {
  return `joined ${new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

function CommunityDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [members, setMembers] = useState<CommunityMember[] | null>(null);
  const [events, setEvents] = useState<CommunityEvent[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    communitiesApi
      .getCommunity(accessToken, id)
      .then(setCommunity)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this community."));
  }, [accessToken, id]);

  useEffect(() => {
    if (!accessToken) return;
    if (tab === "members" && members === null) communitiesApi.listCommunityMembers(accessToken, id).then(setMembers).catch(() => setMembers([]));
    if (tab === "events" && events === null) communitiesApi.listCommunityEvents(accessToken, id).then(setEvents).catch(() => setEvents([]));
  }, [tab, accessToken, id, members, events]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  async function reload() {
    if (!accessToken) return;
    setCommunity(await communitiesApi.getCommunity(accessToken, id));
  }

  async function join() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await communitiesApi.joinCommunity(accessToken, id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await communitiesApi.leaveCommunity(accessToken, id);
      await reload();
      setMenuOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't leave. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!accessToken || !community) return;
    const favorite = !community.isFavorite;
    setCommunity({ ...community, isFavorite: favorite });
    try {
      await communitiesApi.setCommunityFavorite(accessToken, id, favorite);
    } catch {
      setCommunity((c) => (c ? { ...c, isFavorite: !favorite } : c));
    }
  }

  async function submitReport() {
    if (!accessToken) return;
    try {
      await communitiesApi.reportCommunity(accessToken, id, reportReason);
      setToast("Thanks — our team will take a look.");
    } catch {
      setToast("Couldn't send the report. Please try again.");
    } finally {
      setReportOpen(false);
      setReportReason("");
      setMenuOpen(false);
    }
  }

  if (!community) {
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

  const c = community;
  const reportLink = (
    <button type="button" onClick={() => setReportOpen(true)} className="self-start py-2 font-body text-[13px] font-medium text-danger">
      Report community
    </button>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background pb-10">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background px-5 py-4">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-full bg-card">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} className="dark-invert" />
        </button>
        <h1 className="font-heading text-lg font-bold text-heading">Community</h1>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="More" className="flex size-9 items-center justify-center rounded-full bg-card font-heading text-lg leading-none text-heading">
          ⋯
        </button>
      </header>

      <main className="flex flex-col gap-4 px-5">
        {/* Cover */}
        <div className="relative h-[180px] w-full overflow-hidden rounded-2xl bg-[#eef3e9]">
          {c.coverImageUrl ? (
            <Image src={cloudinaryDisplayUrl(c.coverImageUrl, { width: 760 })} alt="" fill sizes="430px" className="object-cover" unoptimized priority />
          ) : (
            <span className="flex size-full items-center justify-center text-5xl">{c.emoji}</span>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-full bg-white/92 px-[9px] py-[3px] font-body text-[11px] font-medium text-[#1b3b2b]">Age {c.minAge}-{c.maxAge}</span>
            <span className="rounded-full bg-white/92 px-[9px] py-[3px] font-body text-[11px] font-medium text-[#1b3b2b]">{c.city}</span>
          </div>
          <button
            type="button"
            aria-pressed={c.isFavorite}
            aria-label={c.isFavorite ? "Remove from favourites" : "Add to favourites"}
            onClick={() => void toggleFavorite()}
            className={`absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-full shadow ${c.isFavorite ? "bg-accent" : "bg-white/90"}`}
          >
            <Image src={c.isFavorite ? "/icons/home/heart-filled.svg" : "/icons/home/heart-outline.svg"} alt="" width={15} height={15} />
          </button>
          {c.isMember ? (
            <span className="absolute bottom-3 right-3 rounded-full bg-accent px-4 py-1.5 font-body text-[13px] font-bold text-[#1b3b2b]">Joined</span>
          ) : (
            <button type="button" disabled={busy} onClick={() => void join()} className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-ink px-4 py-1.5 font-body text-[13px] font-bold text-white disabled:opacity-60">
              <PlusIcon size={14} />
              {busy ? "Joining…" : "Join"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-xl font-bold text-heading">{c.name}</h2>
          <div className="flex items-center gap-2">
            <span className="font-body text-[13px] text-body-text">{c.memberCount} members</span>
            {c.admin && (
              <span className="flex items-center gap-1.5">
                <span className="text-body-text">·</span>
                <Avatar name={c.admin.displayName ?? "Admin"} photoUrl={c.admin.photoUrl} size={20} />
                <span className="font-body text-[13px] text-body-text">{c.admin.displayName} Admin</span>
              </span>
            )}
          </div>
        </div>

        <p className="font-body text-sm leading-5 text-body-text">{c.description}</p>

        {/* Community chat row (members only) */}
        {c.chat && (
          <Link href={`/chats/${c.chat.conversationId}`} className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/25">
              <ChatIcon size={18} className="text-heading" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-body text-sm font-bold text-heading">Community chat</span>
                {c.chat.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 font-body text-[11px] font-bold text-[#1b3b2b]">{c.chat.unread} new</span>}
              </span>
              <span className="block truncate font-body text-xs text-body-text">{c.chat.lastMessagePreview ?? "Say hi to the group 👋"}</span>
            </span>
            <ChevronRightIcon size={18} className="shrink-0 text-body-text" />
          </Link>
        )}

        {/* Stats */}
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card py-3">
            <span className="font-heading text-xl font-bold text-heading">{c.memberCount}</span>
            <span className="font-body text-xs text-body-text">Members</span>
          </div>
          <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card py-3">
            <span className="font-heading text-xl font-bold text-heading">{c.eventCount}</span>
            <span className="font-body text-xs text-body-text">Events</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-full bg-toggle-bg p-1">
          {(["overview", "members", "events"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`h-9 flex-1 rounded-full font-body text-[13px] font-bold capitalize ${tab === t ? "bg-ink text-white" : "text-body-text"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            {c.vibe.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.36px] text-body-text">Vibe</h3>
                <div className="flex flex-wrap gap-2">
                  {c.vibe.map((v) => (
                    <span key={v} className="rounded-full bg-toggle-bg px-3.5 py-1.5 font-body text-[13px] text-heading">{v}</span>
                  ))}
                </div>
              </div>
            )}
            {c.rules.length > 0 && (
              <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
                <h3 className="font-body text-xs font-bold uppercase tracking-[0.36px] text-body-text">Rules</h3>
                <ol className="flex flex-col gap-2">
                  {c.rules.map((r, i) => (
                    <li key={r} className="flex gap-2 font-body text-sm text-heading">
                      <span className="font-bold text-body-text">{i + 1}.</span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {reportLink}
          </div>
        )}

        {tab === "members" && (
          <div className="flex flex-col">
            {members === null && <p className="py-3 font-body text-sm text-body-text">Loading…</p>}
            {members?.map((m) => (
              <Link key={m.id} href={`/padi/${m.id}`} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.displayName ?? "Padi"} photoUrl={m.photoUrl} size={44} />
                <span className="flex flex-col">
                  <span className="font-body text-sm font-bold text-heading">{m.displayName ?? "Padi"}</span>
                  <span className="font-body text-xs text-body-text">{m.role === "OWNER" ? "Admin" : `Member · ${joinedLabel(m.joinedAt)}`}</span>
                </span>
              </Link>
            ))}
            {members && c.memberCount > members.length && (
              <p className="py-3 text-center font-body text-[13px] font-medium text-body-text">+ {c.memberCount - members.length} more members</p>
            )}
            <div className="pt-2">{reportLink}</div>
          </div>
        )}

        {tab === "events" && (
          <div className="flex flex-col gap-3">
            {events === null && <p className="py-3 font-body text-sm text-body-text">Loading…</p>}
            {events?.map((e) => (
              <Link key={e.id} href={`/hangouts/${e.id}`} className="flex items-center gap-3 rounded-2xl bg-card p-2.5">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#eef3e9]">
                  {e.coverImageUrl ? (
                    <Image src={cloudinaryDisplayUrl(e.coverImageUrl, { width: 160 })} alt="" fill sizes="56px" className="object-cover" unoptimized />
                  ) : (
                    <span className="flex size-full items-center justify-center text-2xl">{e.emoji ?? "🎉"}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-sm font-bold text-heading">{e.title}</span>
                  <span className="block truncate font-body text-xs text-body-text">{formatDayTime(e.startAt)} · {e.addressText}</span>
                </span>
              </Link>
            ))}
            {events && events.length === 0 && <p className="py-2 font-body text-sm text-body-text">No events yet.</p>}
            {c.isMember && (
              <Link href={`/hangouts/new?communityId=${c.id}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-body-text font-body text-sm font-bold text-heading">
                <PlusIcon size={16} />
                Host an event for this community
              </Link>
            )}
            <div className="pt-1">{reportLink}</div>
          </div>
        )}

        {error && <p className="font-body text-sm text-danger">{error}</p>}
      </main>

      {/* "⋯" menu */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={c.name}>
        <div className="flex flex-col">
          {!c.isMember && (
            <button type="button" disabled={busy} onClick={() => void join()} className="flex items-center gap-3 py-3 text-left font-body text-sm font-medium text-heading">
              <PlusIcon size={18} /> Join community
            </button>
          )}
          {c.isMember && !c.isOwner && (
            <button type="button" disabled={busy} onClick={() => void leave()} className="flex items-center gap-3 py-3 text-left font-body text-sm font-medium text-heading">
              <TicketIcon size={18} /> Leave community
            </button>
          )}
          <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="flex items-center gap-3 py-3 text-left font-body text-sm font-medium text-danger">
            Report community
          </button>
        </div>
      </BottomSheet>

      {/* Report sheet */}
      <BottomSheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report community" description="Tell us what's wrong. Our team will review it.">
        <div className="flex flex-col gap-3">
          <textarea value={reportReason} maxLength={500} rows={3} onChange={(e) => setReportReason(e.target.value)} placeholder="Reason (optional)" className="resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text" />
          <Button onClick={() => void submitReport()}>Submit report</Button>
          <Button variant="text" onClick={() => setReportOpen(false)}>Cancel</Button>
        </div>
      </BottomSheet>

      <p aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center">
        {toast && <span className="rounded-full bg-ink px-4 py-2 font-body text-[13px] text-white shadow-lg">{toast}</span>}
      </p>
    </div>
  );
}

export default function CommunityDetailPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <CommunityDetailContent />
      </RequireCountry>
    </RequireAuth>
  );
}
