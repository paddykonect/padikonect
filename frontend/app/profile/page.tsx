"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabScreen } from "@/components/navigation/TabScreen";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventListItem, MyRsvp } from "@/features/events/types";
import { NightModeButton } from "@/features/theme/NightModeButton";
import { RequireCountry } from "@/features/profile/require-country";
import { DRINK_PREFERENCE_LABEL, OwnProfile } from "@/features/profile/types";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { formatDayTime } from "@/lib/format/time";

const REWARDS_GOAL = 10;

type ProfileTab = "info" | "stats" | "badges";

// Figma node 379:1105 ("Profile (You)").
function ProfileContent() {
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const { profile } = useOwnProfile();
  const [hangouts, setHangouts] = useState<EventListItem[] | null>(null);
  const [pendingRsvps, setPendingRsvps] = useState<MyRsvp[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("info");

  useEffect(() => {
    if (!accessToken) return;
    eventsApi.listMyEvents(accessToken).then(setHangouts).catch(() => setHangouts([]));
    eventsApi
      .listMyRsvps(accessToken)
      .then((list) => setPendingRsvps(list.filter((r) => r.rsvpStatus === "REQUESTED" || r.rsvpStatus === "WAITLISTED")))
      .catch(() => undefined);
  }, [accessToken]);

  const name = profileName(profile);

  return (
    <TabScreen active="you" user={{ name, photoUrl: profile?.photoUrl ?? null }}>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold leading-8 text-heading">You</h1>
        <div className="flex items-center gap-2">
          <NightModeButton />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex size-[42px] items-center justify-center rounded-full border border-border-subtle bg-card"
          >
            <Image src="/icons/profile/settings.svg" alt="" width={18} height={18} />
          </button>
        </div>
      </div>

      <PhotoHero name={name} age={profile?.age ?? null} photoUrl={profile?.photoUrl ?? null} />

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={profile?.hostedCount ?? 0} label="Hosted" />
        <StatCard value={profile?.attendedCount ?? 0} label="Joined" />
        <StatCard value={profile?.padiCount ?? 0} label="Padis" />
      </div>

      <TabSwitcher value={tab} onChange={setTab} />

      {tab === "info" && <InfoTab profile={profile} />}
      {tab === "stats" && <StatsTab profile={profile} />}
      {tab === "badges" && <BadgesTab profile={profile} />}

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
                    <Image src={h.coverImageUrl} alt="" fill sizes="175px" className="object-cover" unoptimized />
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

// Swipeable photo card. Profiles currently carry a single photo, so the
// arrows/dots only appear once there's more than one to page through.
function PhotoHero({ name, age, photoUrl }: { name: string; age: number | null; photoUrl: string | null }) {
  const photos = photoUrl ? [photoUrl] : [];
  const [index, setIndex] = useState(0);
  const current = photos[index];
  const title = age != null ? `${name}, ${age}` : name;

  function page(delta: number) {
    setIndex((i) => (photos.length ? (i + delta + photos.length) % photos.length : 0));
  }

  return (
    <div className="relative aspect-[345/338] w-full overflow-hidden rounded-[20px] bg-accent/35">
      {current ? (
        <Image src={current} alt={name} fill sizes="430px" className="object-cover" unoptimized />
      ) : (
        <span className="flex size-full items-center justify-center font-heading text-5xl font-bold text-heading/70">
          {initials(name)}
        </span>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => page(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
          >
            <Image src="/icons/chevron-left.svg" alt="" width={14} height={14} className="invert" />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-heading"
          >
            <Image src="/icons/chevron-left.svg" alt="" width={14} height={14} className="rotate-180" />
          </button>
        </>
      )}

      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-live" />
            <span className="font-body text-[11px] font-medium text-heading">Online</span>
          </span>
          <span className="truncate font-heading text-[22px] font-bold text-white drop-shadow">{title}</span>
        </div>
        {photos.length > 0 && (
          <div className="flex shrink-0 items-center gap-1 pb-1">
            {photos.map((p, i) => (
              <span
                key={p}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-accent" : "w-4 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "stats", label: "Stats" },
  { id: "badges", label: "Badges" },
];

function TabSwitcher({ value, onChange }: { value: ProfileTab; onChange: (t: ProfileTab) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-toggle-bg p-1">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-pressed={value === t.id}
          className={`flex-1 rounded-full py-2.5 font-body text-[13px] transition-colors ${
            value === t.id ? "bg-ink font-bold text-white" : "font-medium text-body-text"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function InfoTab({ profile }: { profile: OwnProfile | null }) {
  const chips = [
    ...(profile?.interests ?? []),
    ...(profile && profile.drinkPreference !== "BOTH" ? [DRINK_PREFERENCE_LABEL[profile.drinkPreference]] : []),
  ];
  const wants = profile?.wantsToBeInvitedFor?.trim();

  return (
    <div className="flex flex-col gap-4">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="flex h-[30px] items-center rounded-full border border-border-subtle bg-card px-[13px] font-body text-xs text-heading"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <Link
        href="/profile/edit"
        className="flex items-center gap-3 rounded-2xl bg-accent/30 p-4"
        aria-label="Edit what you want to be invited for"
      >
        <span className="text-2xl leading-none">🎉</span>
        <span className="flex min-w-0 flex-col">
          <span className="font-body text-[11px] font-bold uppercase tracking-wide text-heading/60">
            Wants to be invited for
          </span>
          <span className={`font-heading text-[15px] font-bold ${wants ? "text-heading" : "text-heading/50"}`}>
            {wants || "Add what you'd like to be invited for"}
          </span>
        </span>
      </Link>
    </div>
  );
}

function StatsTab({ profile }: { profile: OwnProfile | null }) {
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
function BadgesTab({ profile }: { profile: OwnProfile | null }) {
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
        <div
          key={b.label}
          className={`flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 text-center ${b.earned ? "" : "opacity-60"}`}
        >
          <span
            className={`flex size-12 items-center justify-center rounded-full text-2xl ${
              b.earned ? "bg-accent/30" : "bg-toggle-bg grayscale"
            }`}
          >
            {b.emoji}
          </span>
          <span className="font-body text-[12px] font-bold leading-tight text-heading">{b.label}</span>
          <span className="font-body text-[10px] leading-tight text-body-text">{b.earned ? "Unlocked" : b.hint}</span>
        </div>
      ))}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
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
