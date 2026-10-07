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
import * as padisApi from "@/features/padis/api";
import { PadiProfile } from "@/features/padis/types";
import * as profileApi from "@/features/profile/api";
import { RequireCountry } from "@/features/profile/require-country";
import { DRINK_PREFERENCE_LABEL, PublicProfile } from "@/features/profile/types";
import { ApiError } from "@/lib/api/client";
import { formatDayTime } from "@/lib/format/time";

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// Figma "Padi profile" (html export node 560:3214). The "Padi score" is the
// average peer rating (shown under the name + rateable after a shared hangout);
// the verified badge still needs identity verification, which doesn't exist yet.
function PadiProfileContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [data, setData] = useState<PadiProfile | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    padisApi
      .getPadiProfile(accessToken, id)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this profile."));
    // Interests + drink preference live on the public profile.
    profileApi.getPublicProfile(accessToken, id).then(setPublicProfile).catch(() => undefined);
  }, [accessToken, id]);

  async function setPadi(add: boolean) {
    if (!accessToken || !data) return;
    setBusy(true);
    try {
      if (add) await padisApi.addPadi(accessToken, id);
      else await padisApi.removePadi(accessToken, id);
      setData(await padisApi.getPadiProfile(accessToken, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function submitRating(stars: number) {
    if (!accessToken || !data?.rateableEventId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ctx = await padisApi.ratePadi(accessToken, id, { eventId: data.rateableEventId, stars });
      setData((prev) => (prev ? { ...prev, ...ctx } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your rating.");
    } finally {
      setBusy(false);
    }
  }

  const memberSince = data ? new Date(data.memberSince).toLocaleString("en-NG", { month: "short", year: "numeric" }) : "";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="flex items-center justify-between px-5 py-4">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-full bg-card">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} className="dark-invert" />
        </button>
        <h1 className="font-heading text-lg font-bold text-heading">Padi profile</h1>
        {data?.isPadi ? (
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="More options" className="flex size-9 items-center justify-center rounded-full bg-card text-lg leading-none text-heading">
            ⋮
          </button>
        ) : (
          <span className="size-9" />
        )}
      </header>

      {error && !data && <p className="px-5 font-body text-sm text-danger">{error}</p>}
      {!data && !error && <p className="px-5 font-body text-sm text-body-text">Loading…</p>}

      {data && (
        <main className="flex flex-col gap-4 px-5 pb-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span
              className="flex size-[104px] items-center justify-center rounded-full p-1"
              style={{ background: data.activeStatus ? "conic-gradient(from 90deg, #d7e600, #4a6620, #1b3b2b, #4a6620, #d7e600)" : "transparent" }}
            >
              <span className="flex size-full items-center justify-center rounded-full bg-background p-0.5">
                <Avatar name={data.user.displayName} photoUrl={data.user.photoUrl} size={90} className="!bg-accent/35" />
              </span>
            </span>
            <p className="font-heading text-xl font-bold text-heading">{data.user.displayName}</p>
            <p className="flex flex-wrap items-center justify-center gap-x-1.5 font-body text-[13px] text-body-text">
              <span className="inline-flex items-center gap-1">
                <span className={`size-1.5 rounded-full ${data.user.online ? "bg-live" : "bg-border"}`} />
                {data.user.online ? "Online" : "Offline"}
              </span>
              {data.ratingCount > 0 && (
                <span>
                  · <span className="text-[#eab308]">★</span> {data.ratingAvg?.toFixed(1)} ({data.ratingCount})
                </span>
              )}
            </p>
            <p className="font-body text-[13px] text-body-text">
              {data.location && <>📍 {data.location} · </>}Padi since {memberSince}
            </p>
            {data.bio && <p className="max-w-[300px] font-body text-sm text-heading">{data.bio}</p>}
            {publicProfile && (publicProfile.interests.length > 0 || publicProfile.drinkPreference !== "BOTH") && (
              <div className="flex max-w-[340px] flex-wrap justify-center gap-1.5 pt-1">
                {[...publicProfile.interests, ...(publicProfile.drinkPreference !== "BOTH" ? [DRINK_PREFERENCE_LABEL[publicProfile.drinkPreference]] : [])].map((chip) => (
                  <span key={chip} className="rounded-full bg-card px-3 py-1 font-body text-xs text-heading">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex rounded-2xl bg-card py-3">
            <Stat value={data.hostedCount} label="Hosted" />
            <Stat value={data.mutualPadis.length} label="Mutual padis" divider />
            <Stat value={data.attendedCount} label="Attended" divider />
          </div>

          {!data.isMe && (
            <div className="flex gap-3">
              {data.isPadi ? (
                <span className="flex h-12 flex-1 items-center justify-center rounded-full bg-accent/35 font-body text-sm font-bold text-heading">✓ Padis</span>
              ) : (
                <button type="button" disabled={busy} onClick={() => void setPadi(true)} className="h-12 flex-1 rounded-full bg-ink font-body text-sm font-bold text-white disabled:opacity-60">
                  {busy ? "Adding…" : "Add padi"}
                </button>
              )}
              <Link href={`/chats/direct/${data.user.id}`} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-heading font-body text-sm font-bold text-heading">
                💬 Message
              </Link>
            </div>
          )}

          {!data.isMe && data.canRate && (
            <StarRating value={data.myRating} busy={busy} onRate={(s) => void submitRating(s)} />
          )}

          {data.activeStatus && (
            <div className="flex items-center gap-3 rounded-2xl bg-ink p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">🎉</span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-bold text-white">Active status · {timeAgo(data.activeStatus.createdAt)}</p>
                {data.activeStatus.text && <p className="line-clamp-2 font-body text-[13px] text-white/80">&ldquo;{data.activeStatus.text}&rdquo;</p>}
              </div>
            </div>
          )}

          {data.mutualPadis.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-bold text-heading">Mutual padis</h2>
              <div className="flex gap-4 overflow-x-auto [scrollbar-width:none]">
                {data.mutualPadis.map((p) => (
                  <Link key={p.id} href={`/padi/${p.id}`} className="flex w-12 shrink-0 flex-col items-center gap-1">
                    <Avatar name={p.displayName} photoUrl={p.photoUrl} size={48} />
                    <span className="max-w-full truncate font-body text-[11px] text-heading">{p.displayName.split(" ")[0]}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-bold text-heading">Hosted hangouts</h2>
            {data.hostedHangouts.length === 0 ? (
              <p className="font-body text-[13px] text-body-text">No upcoming hangouts.</p>
            ) : (
              data.hostedHangouts.map((h) => (
                <div key={h.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent/35 text-2xl">🎉</span>
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-bold text-heading">{h.title}</p>
                    <p className="truncate font-body text-xs text-body-text">
                      {formatDayTime(h.startAt)} · {h.addressText} · {h.goingCount} going
                    </p>
                  </div>
                </div>
              ))
            )}
          </section>
          {error && <p className="font-body text-sm text-danger">{error}</p>}
        </main>
      )}

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={data?.user.displayName ?? ""}>
        <Button type="button" variant="text" loading={busy} onClick={() => void setPadi(false)} className="!text-danger">
          Remove padi
        </Button>
      </BottomSheet>
    </div>
  );
}

function Stat({ value, label, divider }: { value: number; label: string; divider?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-0.5 ${divider ? "border-l border-border-subtle" : ""}`}>
      <span className="font-heading text-lg font-bold text-heading">{value}</span>
      <span className="font-body text-xs text-body-text">{label}</span>
    </div>
  );
}

// Shown only when you shared a hangout with this padi (data.canRate). Tapping a
// star submits the rating.
function StarRating({ value, busy, onRate }: { value: number | null; busy: boolean; onRate: (stars: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value || 0;
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
      <p className="font-body text-sm font-bold text-heading">{value ? "Your rating" : "Rate this padi"}</p>
      <p className="font-body text-xs text-body-text">You shared a hangout — tap a star to rate them.</p>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onMouseEnter={() => setHover(s)}
            onClick={() => onRate(s)}
            aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
            className={`text-2xl leading-none disabled:opacity-60 ${active >= s ? "text-[#eab308]" : "text-border"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PadiProfilePage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <PadiProfileContent />
      </RequireCountry>
    </RequireAuth>
  );
}
