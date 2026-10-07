"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabScreen } from "@/components/navigation/TabScreen";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as communitiesApi from "@/features/communities/api";
import { CommunityCard } from "@/features/communities/CommunityCard";
import { CreateCommunitySheet } from "@/features/communities/CreateCommunitySheet";
import { Community } from "@/features/communities/types";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { NightModeButton } from "@/features/theme/NightModeButton";
import { ApiError } from "@/lib/api/client";

// Figma "Communities" (html export node 560:3018).
function CommunitiesContent() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { profile } = useOwnProfile();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    communitiesApi
      .listCommunities(accessToken)
      .then(setCommunities)
      .catch(() => setCommunities([]));
  }, [accessToken]);

  async function join(c: Community) {
    if (!accessToken) return;
    setJoining(c.id);
    setError(null);
    try {
      const updated = await communitiesApi.joinCommunity(accessToken, c.id);
      setCommunities((list) => list?.map((x) => (x.id === c.id ? updated : x)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join. Please try again.");
    } finally {
      setJoining(null);
    }
  }

  const mine = communities?.filter((c) => c.isMember) ?? [];
  const popular = communities?.filter((c) => !c.isMember) ?? [];

  return (
    <TabScreen active="community" user={{ name: profileName(profile, user?.fullName ?? ""), photoUrl: profile?.photoUrl ?? null }}>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-heading">Communities</h1>
        <NightModeButton />
      </div>

      <div className="flex items-center gap-3.5 rounded-2xl bg-ink p-[18px]">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/25">
          <Image src="/icons/community/crew.svg" alt="" width={22} height={22} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="font-body text-[14.5px] font-bold text-white">Find your padi crew</p>
          <p className="font-body text-xs text-[#c7d0ca]">Join a community that shares your vibe.</p>
        </div>
      </div>

      <button type="button" onClick={() => setCreating(true)} className="flex h-11 items-center justify-center gap-2 rounded-full bg-accent font-body text-sm font-bold text-[#1b3b2b]">
        <Image src="/icons/community/plus.svg" alt="" width={16} height={16} />
        Start a community
      </button>

      <Link href="/moments" className="flex items-center justify-between rounded-2xl bg-card px-4 py-3.5">
        <span>
          <span className="block font-body text-sm font-bold text-heading">Padi moments</span>
          <span className="block font-body text-xs text-body-text">See and share photos from hangouts</span>
        </span>
        <span aria-hidden className="text-lg text-heading">›</span>
      </Link>

      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {communities === null && <p className="font-body text-sm text-body-text">Loading…</p>}

      {mine.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <h2 className="pt-1 font-heading text-lg font-bold text-heading">Your communities</h2>
          {mine.map((c, i) => (
            <CommunityCard key={c.id} community={c} index={i} busy={false} onJoin={() => undefined} />
          ))}
        </section>
      )}

      {communities !== null && (
        <section className="flex flex-col gap-3.5 pb-3">
          <h2 className="pt-1 font-heading text-lg font-bold text-heading">Popular near you</h2>
          {popular.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center font-body text-[13px] text-body-text">
              {mine.length > 0 ? "You've joined every community nearby. Start a new one!" : "No communities yet — start the first one!"}
            </p>
          ) : (
            popular.map((c, i) => <CommunityCard key={c.id} community={c} index={i + mine.length} busy={joining === c.id} onJoin={() => void join(c)} />)
          )}
        </section>
      )}

      {accessToken && (
        <CreateCommunitySheet
          open={creating}
          accessToken={accessToken}
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false);
            if (c.conversationId) router.push(`/chats/${c.conversationId}`);
            else setCommunities((list) => [c, ...(list ?? [])]);
          }}
        />
      )}
    </TabScreen>
  );
}

export default function CommunitiesPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <CommunitiesContent />
      </RequireCountry>
    </RequireAuth>
  );
}
