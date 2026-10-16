"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabScreen } from "@/components/navigation/TabScreen";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventListItem, MyRsvp } from "@/features/events/types";
import { NightModeButton } from "@/features/theme/NightModeButton";
import { RequireCountry } from "@/features/profile/require-country";
import { OwnProfile } from "@/features/profile/types";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { cloudinaryDisplayUrl } from "@/lib/media/cloudinary";
import { formatDayTime } from "@/lib/format/time";

const REWARDS_GOAL = 10;

function inviteLabel(profile: OwnProfile | null): string {
  if (profile?.invitePlans?.length) return profile.invitePlans.join(" · ");
  return profile?.wantsToBeInvitedFor?.trim() || "Anything — Surprise me";
}

// Figma node 379:1105 ("Profile (You)").
function ProfileContent() {
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const { profile } = useOwnProfile();
  const [hangouts, setHangouts] = useState<EventListItem[] | null>(null);
  const [pendingRsvps, setPendingRsvps] = useState<MyRsvp[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    eventsApi.listMyEvents(accessToken).then(setHangouts).catch(() => setHangouts([]));
    eventsApi
      .listMyRsvps(accessToken)
      .then((list) => setPendingRsvps(list.filter((r) => r.rsvpStatus === "REQUESTED" || r.rsvpStatus === "WAITLISTED")))
      .catch(() => undefined);
  }, [accessToken]);

  const name = profileName(profile);
  const firstName = name.split(/\s+/)[0];
  const location = profile?.state ?? profile?.country ?? null;
  const subtitle = [profile?.bio?.trim(), location].filter(Boolean).join(" · ");
  const title = profile?.age != null ? `${name}, ${profile.age}` : name;
  const photos = profile?.photos ?? [];

  return (
    <TabScreen active="you" user={{ name, photoUrl: profile?.photoUrl ?? null }}>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold leading-8 text-heading">You</h1>
        <NightModeButton />
      </div>

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar name={name} photoUrl={profile?.photoUrl ?? null} size={100} className="!bg-accent/35" />
        <h2 className="font-heading text-xl font-bold text-heading">{title}</h2>
        {subtitle && <p className="font-body text-[13px] text-body-text">{subtitle}</p>}
      </div>

      {/* Edit + settings */}
      <div className="flex items-center gap-3">
        <Link href="/profile/edit" className="flex-1">
          <Button type="button" variant="text" className="w-full border border-border">
            <span className="flex items-center justify-center gap-2">
              <Image src="/icons/edit.svg" alt="" width={15} height={15} className="dark-invert" />
              Edit Profile
            </span>
          </Button>
        </Link>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="flex size-[46px] shrink-0 items-center justify-center rounded-full border border-border-subtle bg-card"
        >
          <Image src="/icons/profile/settings.svg" alt="" width={18} height={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={profile?.hostedCount ?? 0} label="Hosted" />
        <StatCard value={profile?.attendedCount ?? 0} label="Joined" />
        <StatCard value={profile?.padiCount ?? 0} label="Padis" />
      </div>

      {/* Wants to be invited for */}
      <Link href="/profile/invite-preferences" className="flex items-center gap-3 rounded-2xl bg-accent/30 p-4" aria-label="Edit invitation preferences">
        <span className="text-2xl leading-none">🎉</span>
        <span className="flex min-w-0 flex-col">
          <span className="font-body text-[11px] font-bold uppercase tracking-wide text-heading/60">Wants to be invited for</span>
          <span className="font-heading text-[15px] font-bold text-heading">{inviteLabel(profile)}</span>
        </span>
      </Link>

      {/* Interests */}
      {(profile?.interests?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-heading text-lg font-bold text-heading">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {profile!.interests.map((tag) => (
              <span key={tag} className="flex h-[30px] items-center rounded-full border border-border-subtle bg-card px-[13px] font-body text-xs text-heading">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Profile fotos */}
      {photos.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-heading">Profile fotos</h2>
            <span className="font-body text-[13px] text-body-text">{photos.length} Photos</span>
          </div>
          <div className="relative aspect-[345/260] w-full overflow-hidden rounded-2xl bg-border-subtle">
            <Image src={cloudinaryDisplayUrl(photos[0].url, { width: 760 })} alt="" fill sizes="430px" className="object-cover" unoptimized />
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-3 gap-2.5">
              {photos.slice(1, 4).map((p) => (
                <div key={p.url} className="relative aspect-square overflow-hidden rounded-xl bg-border-subtle">
                  <Image src={cloudinaryDisplayUrl(p.url, { width: 240 })} alt="" fill sizes="120px" className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Vibe */}
      {(profile?.vibe?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-heading text-lg font-bold text-heading">{firstName}&apos;s vibe</h2>
          <div className="flex flex-wrap gap-2">
            {profile!.vibe.map((tag) => (
              <span key={tag} className="flex h-[30px] items-center gap-1.5 rounded-full border border-border-subtle bg-card px-[13px] font-body text-xs text-heading">
                <span className="size-1.5 rounded-full bg-accent" />
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Your hangouts */}
      <section className="flex flex-col gap-2.5">
        <h2 className="font-heading text-lg font-bold text-heading">Your hangouts</h2>
        {hangouts === null ? (
          <p className="font-body text-sm text-body-text">Loading…</p>
        ) : hangouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center font-body text-[13px] text-body-text">
            Hangouts you host or join will show up here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {hangouts.map((h) => (
              <Link key={h.id} href={`/hangouts/${h.id}`} className="flex flex-col overflow-hidden rounded-2xl bg-card">
                <div className="relative h-[92px] w-full bg-border-subtle">
                  {h.coverImageUrl ? (
                    <Image src={cloudinaryDisplayUrl(h.coverImageUrl, { width: 350 })} alt="" fill sizes="175px" className="object-cover" unoptimized />
                  ) : (
                    <span className="flex size-full items-center justify-center text-2xl">🎉</span>
                  )}
                </div>
                <p className="truncate px-3 py-2.5 font-body text-[13px] font-medium text-heading">{h.title}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {pendingRsvps.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-heading text-lg font-bold text-heading">Waiting on the host</h2>
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-card">
            {pendingRsvps.map((r, i) => (
              <li key={r.event.id} className={i > 0 ? "border-t border-divider" : ""}>
                <Link href={`/hangouts/${r.event.id}`} className="flex items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-body text-sm font-medium text-heading">{r.event.title}</span>
                    <span className="block font-body text-xs text-body-text">{formatDayTime(r.event.startAt)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-toggle-bg px-2.5 py-1 font-body text-xs font-medium text-heading">
                    {r.rsvpStatus === "WAITLISTED" ? "Waitlisted" : "Requested"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Rewards + badges kept below the new sections */}
      <StatsSection profile={profile} />
      <section className="flex flex-col gap-2.5">
        <h2 className="font-heading text-lg font-bold text-heading">Badges</h2>
        <BadgesGrid profile={profile} />
      </section>

      <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings" description={profile?.email}>
        <Link href="/profile/edit" className="w-full">
          <Button type="button" variant="primary">
            Edit profile
          </Button>
        </Link>
        <Button
          type="button"
          variant="text"
          onClick={async () => {
            await logout();
            router.push("/");
          }}
        >
          Log out
        </Button>
      </BottomSheet>
    </TabScreen>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl bg-card py-4">
      <span className="font-heading text-xl font-bold text-heading">{value}</span>
      <span className="font-body text-[13px] text-body-text">{label}</span>
    </div>
  );
}

function StatsSection({ profile }: { profile: OwnProfile | null }) {
  const hosted = profile?.hostedCount ?? 0;
  const rewardsDone = Math.min(hosted, REWARDS_GOAL);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-2xl bg-ink p-4">
        <div className="flex items-center justify-between">
          <span className="font-body text-sm font-medium text-white">Padi Rewards</span>
          <span className="font-body text-[13px] font-medium text-accent">
            {rewardsDone} / {REWARDS_GOAL} hangouts
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/16">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(rewardsDone / REWARDS_GOAL) * 100}%` }} />
        </div>
        <p className="font-body text-xs text-[#c7d0ca]">
          {rewardsDone < REWARDS_GOAL
            ? `Host ${REWARDS_GOAL - rewardsDone} more to unlock a free round at any registered lounge`
            : "You've unlocked a free round at any registered lounge! 🎉"}
        </p>
      </div>

      <div className="flex flex-col divide-y divide-border-subtle rounded-2xl bg-card px-4">
        <StatRow label="Padi points" value={profile?.padiPoints ?? 0} />
        <StatRow label="Hangouts hosted" value={hosted} />
        <StatRow label="Hangouts joined" value={profile?.attendedCount ?? 0} />
        <StatRow label="Padis" value={profile?.padiCount ?? 0} />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="font-body text-sm text-body-text">{label}</span>
      <span className="font-heading text-base font-bold text-heading">{value}</span>
    </div>
  );
}

// Milestones derived from the profile's own counts — no separate badge store.
function BadgesGrid({ profile }: { profile: OwnProfile | null }) {
  const hosted = profile?.hostedCount ?? 0;
  const joined = profile?.attendedCount ?? 0;
  const padis = profile?.padiCount ?? 0;
  const points = profile?.padiPoints ?? 0;

  const badges = [
    { emoji: "🎉", label: "First host", earned: hosted >= 1, hint: "Host a hangout" },
    { emoji: "🏆", label: "Host pro", earned: hosted >= 5, hint: "Host 5 hangouts" },
    { emoji: "🦋", label: "Social butterfly", earned: joined >= 10, hint: "Join 10 hangouts" },
    { emoji: "🤝", label: "Connector", earned: padis >= 5, hint: "Add 5 padis" },
    { emoji: "⭐", label: "Padi star", earned: points >= 100, hint: "Earn 100 points" },
    { emoji: "🔥", label: "Regular", earned: hosted + joined >= 20, hint: "20 hangouts total" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map((b) => (
        <div key={b.label} className={`flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 text-center ${b.earned ? "" : "opacity-60"}`}>
          <span className={`flex size-12 items-center justify-center rounded-full text-2xl ${b.earned ? "bg-accent/30" : "bg-toggle-bg grayscale"}`}>{b.emoji}</span>
          <span className="font-body text-[12px] font-bold leading-tight text-heading">{b.label}</span>
          <span className="font-body text-[10px] leading-tight text-body-text">{b.earned ? "Unlocked" : b.hint}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <ProfileContent />
      </RequireCountry>
    </RequireAuth>
  );
}
