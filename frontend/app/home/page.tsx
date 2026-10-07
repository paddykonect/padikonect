"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventFilters, EventListItem } from "@/features/events/types";
import { HangoutCard } from "@/features/hangouts/components/HangoutCard";
import { PlusIcon } from "@/features/hangouts/components/icons";
import { PreviewCarousel } from "@/features/hangouts/components/PreviewCarousel";
import { distanceMeters, placeCoords, toPlaces } from "@/features/hangouts/places";
import { FavoritesRow } from "@/features/home/components/FavoritesRow";
import { FilterPills, HomeFilter } from "@/features/home/components/FilterPills";
import { HangoutsMap } from "@/features/home/components/HangoutsMap";
import { HomeHeader } from "@/features/home/components/HomeHeader";
import { PadisPanel } from "@/features/home/components/PadisPanel";
import { RewardsCard } from "@/features/home/components/RewardsCard";
import { StatusComposer } from "@/features/home/components/StatusComposer";
import { StatusRow } from "@/features/home/components/StatusRow";
import { StatusViewer } from "@/features/home/components/StatusViewer";
import { HomeView, ViewToggle } from "@/features/home/components/ViewToggle";
import * as notificationsApi from "@/features/notifications/api";
import * as padisApi from "@/features/padis/api";
import { StatusGroup } from "@/features/padis/types";
import * as profileApi from "@/features/profile/api";
import { INTEREST_OPTIONS } from "@/features/profile/interests";
import { OwnProfile } from "@/features/profile/types";
import { RequireCountry } from "@/features/profile/require-country";
import { NightModeButton } from "@/features/theme/NightModeButton";
import * as venuesApi from "@/features/venues/api";
import { Venue, VenueCategory } from "@/features/venues/types";
import { ApiError } from "@/lib/api/client";

// Figma node 590:8834 ("Home"). Victoria Island is the fallback map centre
// until the user shares their location.
const DEFAULT_CENTER: [number, number] = [6.4281, 3.4219];
const WALKING_DISTANCE_METERS = 2000;

const VENUE_FILTERS: Partial<Record<HomeFilter, VenueCategory[]>> = {
  restaurants: ["RESTAURANT"],
  lounges: ["LOUNGE", "REGISTERED_LOUNGE", "BAR"],
  rooftops: ["ROOFTOP"],
};
const EVENT_ONLY_FILTERS: HomeFilter[] = ["tonight", "today", "underTwoK", "nonAlcoholic"];

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function getPosition(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition((p) => resolve([p.coords.latitude, p.coords.longitude]), reject, {
      timeout: 10_000,
    });
  });
}

function HomeContent() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // "View the list" (Figma 611:10065) swaps the map for full-width cards.
  const [listMode, setListMode] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [statusGroups, setStatusGroups] = useState<StatusGroup[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [favorites, setFavorites] = useState<Venue[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<EventListItem[]>([]);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [view, setView] = useState<HomeView>("hangouts");
  const [filters, setFilters] = useState<Set<HomeFilter>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    if (!accessToken) return;
    setStatusGroups(await padisApi.getStatusFeed(accessToken));
  }, [accessToken]);

  // One-off loads. Each section degrades on its own if its request fails.
  useEffect(() => {
    if (!accessToken) return;
    profileApi.getOwnProfile(accessToken).then(setProfile).catch(() => undefined);
    notificationsApi
      .listNotifications(accessToken)
      .then((list) => setHasUnread(list.some((n) => !n.readAt)))
      .catch(() => undefined);
    padisApi.getStatusFeed(accessToken).then(setStatusGroups).catch(() => undefined);
    venuesApi.listVenues(accessToken).then((page) => setVenues(page.items)).catch(() => undefined);
    venuesApi.listFavoriteVenues(accessToken).then(setFavorites).catch(() => undefined);
    eventsApi.listFavoriteEvents(accessToken).then(setFavoriteEvents).catch(() => undefined);
  }, [accessToken]);

  // Use the user's location only if they've already granted it — never prompt
  // on page load; the Walking distance filter asks when tapped.
  useEffect(() => {
    if (!navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((s) => (s.state === "granted" ? getPosition().then(setPosition) : undefined))
      .catch(() => undefined);
  }, []);

  const eventFilters: EventFilters = useMemo(
    () => ({
      tonight: filters.has("tonight"),
      today: filters.has("today"),
      nonAlcoholic: filters.has("nonAlcoholic"),
      underTwoK: filters.has("underTwoK"),
      tags: [...tagFilters],
      ...(filters.has("walkingDistance") && position && { walkingDistance: true, lat: position[0], lng: position[1] }),
    }),
    [filters, tagFilters, position],
  );

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    eventsApi
      .listEvents(accessToken, eventFilters)
      .then((page) => !cancelled && setEvents(page.items))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Could not load hangouts."));
    return () => {
      cancelled = true;
    };
  }, [accessToken, eventFilters]);

  const activeVenueCategories = useMemo(
    () => [...filters].flatMap((f) => VENUE_FILTERS[f] ?? []),
    [filters],
  );
  // Places have no tags, so interest chips behave like hangout-only filters.
  const hasEventOnlyFilter = EVENT_ONLY_FILTERS.some((f) => filters.has(f)) || tagFilters.size > 0;

  // Venue-category filters hide hangouts; hangout-only filters hide places.
  const visibleVenues = useMemo(() => {
    if (hasEventOnlyFilter && activeVenueCategories.length === 0) return [];
    return venues.filter(
      (v) =>
        (activeVenueCategories.length === 0 || activeVenueCategories.includes(v.category)) &&
        (!filters.has("walkingDistance") || !position || distanceMeters(position, [v.latitude, v.longitude]) <= WALKING_DISTANCE_METERS),
    );
  }, [venues, filters, position, activeVenueCategories, hasEventOnlyFilter]);
  const visibleEvents = useMemo(
    () => (activeVenueCategories.length > 0 && !hasEventOnlyFilter ? [] : events),
    [activeVenueCategories, hasEventOnlyFilter, events],
  );
  const places = useMemo(() => toPlaces(visibleEvents, visibleVenues), [visibleEvents, visibleVenues]);

  // Search opens a place with /home?focus=event:<id> or venue:<id>. Venues
  // aren't filtered by the API, so look them up in the full list.
  const focus = searchParams.get("focus");
  const allPlaces = useMemo(() => toPlaces(events, venues), [events, venues]);
  const openKey = previewKey ?? (focus && allPlaces.some((p) => p.key === focus) ? focus : null);
  const previewPlaces = useMemo(() => {
    const extra = openKey && !places.some((p) => p.key === openKey) ? allPlaces.filter((p) => p.key === openKey) : [];
    return [...extra, ...places];
  }, [openKey, places, allPlaces]);

  const closePreview = useCallback(() => {
    setPreviewKey(null);
    if (focus) router.replace("/home", { scroll: false });
  }, [focus, router]);

  async function joinHangout(eventId: string) {
    if (!accessToken) return;
    setJoiningId(eventId);
    setError(null);
    try {
      const rsvp = await eventsApi.joinEvent(accessToken, eventId);
      setEvents((list) => list.map((e) => (e.id === eventId ? { ...e, myRsvpStatus: rsvp.status } : e)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request. Please try again.");
    } finally {
      setJoiningId(null);
    }
  }

  async function toggleFilter(id: HomeFilter) {
    setError(null);
    const turningOn = !filters.has(id);
    if (id === "walkingDistance" && turningOn && !position) {
      try {
        setPosition(await getPosition());
      } catch {
        setError("Allow location access to use the Walking distance filter.");
        return;
      }
    }
    setFilters((prev) => {
      const next = new Set(prev);
      if (turningOn) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleTag(tag: string) {
    setTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  // The user's own interests first (incl. custom ones), then the rest.
  const interestChips = useMemo(() => {
    const mine = profile?.interests ?? [];
    return [...mine, ...INTEREST_OPTIONS.filter((t) => !mine.includes(t))];
  }, [profile]);

  async function toggleFavorite(venue: Venue) {
    if (!accessToken) return;
    const favorite = !venue.isFavorite;
    const apply = (fav: boolean) => {
      setVenues((list) => list.map((v) => (v.id === venue.id ? { ...v, isFavorite: fav } : v)));
      setFavorites((list) => (fav ? [{ ...venue, isFavorite: true }, ...list.filter((v) => v.id !== venue.id)] : list.filter((v) => v.id !== venue.id)));
    };
    apply(favorite);
    try {
      await venuesApi.setFavorite(accessToken, venue.id, favorite);
    } catch {
      apply(!favorite);
      setError("Couldn't update your favourites. Please try again.");
    }
  }

  async function toggleEventFavorite(event: EventListItem) {
    if (!accessToken) return;
    const favorite = !event.isFavorite;
    const apply = (fav: boolean) => {
      setEvents((list) => list.map((e) => (e.id === event.id ? { ...e, isFavorite: fav } : e)));
      setFavoriteEvents((list) => (fav ? [{ ...event, isFavorite: true }, ...list.filter((e) => e.id !== event.id)] : list.filter((e) => e.id !== event.id)));
    };
    apply(favorite);
    try {
      await eventsApi.setEventFavorite(accessToken, event.id, favorite);
    } catch {
      apply(!favorite);
      setError("Couldn't update your favourites. Please try again.");
    }
  }

  const name = profile?.displayName ?? user?.fullName ?? "";
  const me = { name, photoUrl: profile?.photoUrl ?? null };
  const nav = <BottomNav active="home" user={me} />;
  const filterPills = (
    <FilterPills
      active={filters}
      onToggle={(id) => void toggleFilter(id)}
      interests={interestChips}
      activeInterests={tagFilters}
      onToggleInterest={toggleTag}
      onClear={() => {
        setFilters(new Set());
        setTagFilters(new Set());
      }}
    />
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <main className="flex flex-1 flex-col gap-4 px-5 pb-4 pt-4">
        {listMode ? (
          // Figma 611:10086: list-view header.
          <div className="flex w-full items-center justify-between">
            <h1 className="font-heading text-2xl font-bold leading-8 text-heading">Hangout</h1>
            <div className="flex items-center gap-2">
              <NightModeButton />
              <Link href="/hangouts/search" className="flex size-10 items-center justify-center rounded-full border border-border bg-card">
                <Image src="/icons/hangout/search.svg" alt="" width={18} height={18} />
                <span className="sr-only">Search</span>
              </Link>
              <Link href="/hangouts/new" className="flex size-10 items-center justify-center rounded-full bg-accent text-[#1b3b2b]">
                <PlusIcon size={20} />
                <span className="sr-only">Host a hangout</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <HomeHeader hasUnread={hasUnread} />

            <h1 className="font-heading text-2xl font-bold leading-8 text-heading">
              {greeting()}
              {name && `, ${name.split(" ")[0]}`}
            </h1>

            <StatusRow me={me} groups={statusGroups} onAdd={() => setComposerOpen(true)} onOpen={setViewerStart} />

            <FavoritesRow
              venues={favorites}
              events={favoriteEvents}
              onToggleFavorite={(v) => void toggleFavorite(v)}
              onToggleEventFavorite={(e) => void toggleEventFavorite(e)}
            />

            <RewardsCard hostedCount={profile?.hostedCount ?? 0} />
          </>
        )}

        <ViewToggle value={view} onChange={setView} />

        {view === "hangouts" ? (
          <>
            {filterPills}
            {error && <p className="font-body text-sm text-danger">{error}</p>}
            {listMode ? (
              <div className="flex flex-col gap-4">
                {places.map((place) => (
                  <HangoutCard
                    key={place.key}
                    place={place}
                    userId={user?.id}
                    distance={position ? distanceMeters(position, placeCoords(place)) : undefined}
                    joining={place.kind === "event" && joiningId === place.event.id}
                    onJoin={(id) => void joinHangout(id)}
                    onToggleFavorite={(v) => void toggleFavorite(v)}
                    onToggleEventFavorite={(e) => void toggleEventFavorite(e)}
                  />
                ))}
                {places.length === 0 && <p className="py-10 text-center font-body text-sm text-body-text">Nothing matches these filters yet.</p>}
              </div>
            ) : (
              <HangoutsMap
                center={position ?? DEFAULT_CENTER}
                isUserLocation={!!position}
                places={places}
                selectedKey={openKey}
                onSelect={setPreviewKey}
                onViewList={() => {
                  setListMode(true);
                  window.scrollTo({ top: 0 });
                }}
                filters={filterPills}
                nav={nav}
                onClosePreview={closePreview}
                preview={
                  openKey ? (
                    <PreviewCarousel
                      places={previewPlaces}
                      startKey={openKey}
                      userId={user?.id}
                      position={position}
                      joiningId={joiningId}
                      onJoin={(id) => void joinHangout(id)}
                      onToggleFavorite={(v) => void toggleFavorite(v)}
                      onToggleEventFavorite={(e) => void toggleEventFavorite(e)}
                      onClose={closePreview}
                    />
                  ) : null
                }
              />
            )}
          </>
        ) : (
          accessToken && <PadisPanel accessToken={accessToken} center={position ?? DEFAULT_CENTER} position={position} nav={nav} />
        )}
      </main>

      <div className="sticky bottom-0 z-10 flex flex-col items-start gap-3 bg-gradient-to-t from-background via-background/90 to-transparent px-5 pb-3 pt-2">
        {listMode && view === "hangouts" && (
          <button
            type="button"
            onClick={() => setListMode(false)}
            className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 shadow-[0px_6px_8px_rgba(0,0,0,0.2)]"
          >
            <Image src="/icons/hangout/map.svg" alt="" width={15} height={15} />
            <span className="font-body text-[13.5px] font-bold text-white">View on map</span>
          </button>
        )}
        {nav}
      </div>

      {accessToken && (
        <StatusComposer
          open={composerOpen}
          accessToken={accessToken}
          onClose={() => setComposerOpen(false)}
          onPosted={() => {
            setComposerOpen(false);
            void loadStatuses();
          }}
        />
      )}
      {accessToken && viewerStart !== null && statusGroups[viewerStart] && (
        <StatusViewer
          key={viewerStart}
          groups={statusGroups}
          startIndex={viewerStart}
          accessToken={accessToken}
          onClose={() => {
            setViewerStart(null);
            void loadStatuses();
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <RequireCountry>
        {/* useSearchParams (search's ?focus=) needs a Suspense boundary. */}
        <Suspense>
          <HomeContent />
        </Suspense>
      </RequireCountry>
    </RequireAuth>
  );
}
