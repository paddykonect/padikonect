"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TabScreen } from "@/components/navigation/TabScreen";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as communitiesApi from "@/features/communities/api";
import { CommunityCard } from "@/features/communities/CommunityCard";
import { Community } from "@/features/communities/types";
import { SearchIcon } from "@/features/hangouts/components/icons";
import { RequireCountry } from "@/features/profile/require-country";
import { profileName, useOwnProfile } from "@/features/profile/use-own-profile";
import { ApiError } from "@/lib/api/client";

// Figma "Favorite communities" — the padi crews you've hearted.
function FavoritesContent() {
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const { profile } = useOwnProfile();
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [query, setQuery] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    communitiesApi
      .listFavoriteCommunities(accessToken)
      .then(setCommunities)
      .catch(() => setCommunities([]));
  }, [accessToken]);

  async function join(c: Community) {
    if (!accessToken) return;
    setJoining(c.id);
    setError(null);
    try {
      const updated = await communitiesApi.joinCommunity(accessToken, c.id);
      setCommunities((list) => list?.map((x) => (x.id === c.id ? { ...updated, isFavorite: true } : x)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't join. Please try again.");
    } finally {
      setJoining(null);
    }
  }

  async function unfavorite(c: Community) {
    if (!accessToken) return;
    // On the favourites page, removing the heart drops it from the list.
    setCommunities((list) => list?.filter((x) => x.id !== c.id) ?? null);
    try {
      await communitiesApi.setCommunityFavorite(accessToken, c.id, false);
    } catch {
      setCommunities((list) => [c, ...(list ?? [])]);
      setError("Couldn't update your favourites. Please try again.");
    }
  }

  const all = communities ?? [];
  const q = query.trim().toLowerCase();
  const shown = all.filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <TabScreen active="community" user={{ name: profileName(profile, user?.fullName ?? ""), photoUrl: profile?.photoUrl ?? null }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 items-center justify-center rounded-full bg-card">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} className="dark-invert" />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold text-heading">Favorite communities</h1>
        <p className="font-body text-[13px] text-body-text">Your padi crews, all in one place.</p>
      </div>

      <label className="flex h-[46px] items-center gap-3 rounded-field border border-border bg-card px-4">
        <SearchIcon size={18} className="shrink-0 text-heading" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your favorites" className="min-w-0 flex-1 bg-transparent font-body text-[15px] text-input-text placeholder:text-body-text outline-none" />
      </label>

      {error && <p className="font-body text-sm text-danger">{error}</p>}
      {communities === null && <p className="font-body text-sm text-body-text">Loading…</p>}

      {communities !== null && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-body text-xs font-bold uppercase tracking-[0.48px] text-body-text">
              {all.length} favorite{all.length === 1 ? "" : "s"}
            </h2>
            <span className="font-body text-[13px] text-body-text">Recently saved</span>
          </div>

          <div className="flex flex-col gap-3.5">
            {shown.map((c) => (
              <CommunityCard
                key={c.id}
                community={c}
                busy={joining === c.id}
                onJoin={() => void join(c)}
                onToggleFavorite={() => void unfavorite(c)}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1 pb-3 pt-4 text-center">
            <p className="font-heading text-[15px] font-bold text-heading">You&apos;re all caught up</p>
            <p className="font-body text-[13px] text-body-text">Tap a heart on any community to save it here.</p>
          </div>
        </>
      )}
    </TabScreen>
  );
}

export default function CommunityFavoritesPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <FavoritesContent />
      </RequireCountry>
    </RequireAuth>
  );
}
