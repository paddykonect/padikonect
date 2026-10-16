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
import { BookmarkIcon, SearchIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { NightModeButton } from "@/features/theme/NightModeButton";
import { ApiError } from "@/lib/api/client";

// Figma "COMMUNITIES" board: banner, Favorites (+ View All), a create card,
// and "Popular near you".
function CommunitiesContent() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { profile } = useOwnProfile();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
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

  async function toggleFavorite(c: Community) {
    if (!accessToken) return;
    const favorite = !c.isFavorite;
    setCommunities((list) => list?.map((x) => (x.id === c.id ? { ...x, isFavorite: favorite } : x)) ?? null);
    try {
      await communitiesApi.setCommunityFavorite(accessToken, c.id, favorite);
    } catch {
      setCommunities((list) => list?.map((x) => (x.id === c.id ? { ...x, isFavorite: !favorite } : x)) ?? null);
      setError("Couldn't update your favourites. Please try again.");
    }
  }

  const all = communities ?? [];
  const favorites = all.filter((c) => c.isFavorite);
  const q = query.trim().toLowerCase();
  const popular = all.filter((c) => !c.isFavorite && (!q || c.name.toLowerCase().includes(q)));

  const cardProps = (c: Community) => ({
    community: c,
    busy: joining === c.id,
    onJoin: () => void join(c),
    onToggleFavorite: () => void toggleFavorite(c),
  });

  return (
    <TabScreen active="community" user={{ name: profileName(profile, user?.fullName ?? ""), photoUrl: profile?.photoUrl ?? null }}>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-heading">Communities</h1>
        <div className="flex items-center gap-2">
          <NightModeButton />
          <button type="button" onClick={() => setSearching((v) => !v)} aria-label="Search communities" className="flex size-9 items-center justify-center rounded-full bg-card">
            <SearchIcon size={17} className="text-heading" />
          </button>
          <button type="button" onClick={() => setCreating(true)} aria-label="Start a community" className="flex size-9 items-center justify-center rounded-full bg-accent text-[#1b3b2b]">
            <Image src="/icons/community/plus.svg" alt="" width={16} height={16} />
          </button>
        </div>
      </div>

      {searching && (
        <label className="flex h-[46px] items-center gap-3 rounded-field border border-border bg-card px-4">
          <SearchIcon size={18} className="shrink-0 text-heading" />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities" className="min-w-0 flex-1 bg-transparent font-body text-[15px] text-input-text placeholder:text-body-text outline-none" />
        </label>
      )}

      <div className="flex items-center gap-3.5 rounded-2xl bg-ink p-[18px]">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/25">
          <Image src="/icons/community/crew.svg" alt="" width={22} height={22} />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="font-body text-[14.5px] font-bold text-white">Find your padi crew</p>
          <p className="font-body text-xs text-[#c7d0ca]">Join a community that shares your vibe.</p>
        </div>
      </div>

      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {communities === null && <p className="font-body text-sm text-body-text">Loading…</p>}

      {communities !== null && all.length === 0 && (
        <div className="flex flex-col items-center gap-3 pt-10 text-center">
          <Image src="/icons/community/crew.svg" alt="" width={64} height={64} />
          <p className="font-heading text-lg font-bold text-heading">No communities yet</p>
          <p className="max-w-[260px] font-body text-[13px] text-body-text">Be the first to bring your padi crew together. Start a community and invite your friends.</p>
          <button type="button" onClick={() => setCreating(true)} className="mt-1 flex h-11 items-center gap-2 rounded-full bg-accent px-6 font-body text-sm font-bold text-[#1b3b2b]">
            <Image src="/icons/community/plus.svg" alt="" width={16} height={16} />
            Start a community
          </button>
        </div>
      )}

      {communities !== null && all.length > 0 && !q && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-body text-xs font-bold uppercase tracking-[0.48px] text-body-text">Favorites</h2>
            {favorites.length > 0 && (
              <Link href="/communities/favorites" className="font-body text-[13px] font-medium text-heading">
                View all
              </Link>
            )}
          </div>
          {favorites.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-5">
              <BookmarkIcon size={18} className="text-body-text" />
              <p className="font-body text-[13px] text-body-text">Favourite a community to see it here.</p>
            </div>
          ) : (
            favorites.slice(0, 2).map((c) => <CommunityCard key={c.id} {...cardProps(c)} />)
          )}
        </section>
      )}

      {communities !== null && all.length > 0 && !q && (
        <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-3.5 rounded-2xl bg-card p-[18px] text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/25">
            <Image src="/icons/community/crew.svg" alt="" width={22} height={22} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="font-body text-sm font-bold text-heading">Create your first community</span>
            <span className="font-body text-xs text-body-text">Start a crew and invite your padis.</span>
          </span>
          <span className="ml-auto rounded-full bg-accent px-4 py-2 font-body text-[13px] font-bold text-[#1b3b2b]">Start</span>
        </button>
      )}

      {communities !== null && all.length > 0 && (
        <section className="flex flex-col gap-3.5 pb-3">
          <h2 className="font-body text-xs font-bold uppercase tracking-[0.48px] text-body-text">{q ? "Results" : "Popular near you"}</h2>
          {popular.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-6 py-8 text-center font-body text-[13px] text-body-text">
              {q ? `No communities match “${query}”.` : "You've favourited every community nearby."}
            </p>
          ) : (
            popular.map((c) => <CommunityCard key={c.id} {...cardProps(c)} />)
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
