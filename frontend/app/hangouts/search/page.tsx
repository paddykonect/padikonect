"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventListItem } from "@/features/events/types";
import { Place, distanceMeters, formatDistance, getGrantedPosition, placeCoords, toPlaces } from "@/features/hangouts/places";
import { RequireCountry } from "@/features/profile/require-country";
import * as venuesApi from "@/features/venues/api";
import { VENUE_CATEGORY_EMOJI, VENUE_CATEGORY_LABEL, Venue } from "@/features/venues/types";
import { formatDayTime } from "@/lib/format/time";

const RECENTS_KEY = "padikonect.recentSearches";
const MAX_RECENTS = 6;
const POPULAR_COUNT = 6;

function loadRecents(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked (private mode etc.) — recents just won't persist.
  }
}

const pill = "flex h-[37px] shrink-0 items-center rounded-full border border-border bg-card px-4 font-body text-[13px] leading-[18px] text-heading";

// Figma "Hangout search" (304:29535): recent searches, then popular places
// nearby — replaced by live results once you type.
function HangoutSearchContent() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [popular, setPopular] = useState<{ events: EventListItem[]; venues: Venue[] }>({ events: [], venues: [] });
  const [results, setResults] = useState<{ q: string; events: EventListItem[]; venues: Venue[] } | null>(null);

  useEffect(() => {
    // Recents live in localStorage, which only exists client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecents(loadRecents());
    void getGrantedPosition().then(setPosition);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([eventsApi.listEvents(accessToken), venuesApi.listVenues(accessToken)])
      .then(([e, v]) => setPopular({ events: e.items, venues: v.items }))
      .catch(() => undefined);
  }, [accessToken]);

  const q = query.trim();
  useEffect(() => {
    if (!accessToken || !q) return;
    let cancelled = false;
    const t = setTimeout(() => {
      Promise.all([eventsApi.listEvents(accessToken, { q }), venuesApi.listVenues(accessToken, { q })])
        .then(([e, v]) => !cancelled && setResults({ q, events: e.items, venues: v.items }))
        .catch(() => !cancelled && setResults({ q, events: [], venues: [] }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [accessToken, q]);

  const byDistance = useMemo(
    () => (list: Place[]) =>
      position ? [...list].sort((a, b) => distanceMeters(position, placeCoords(a)) - distanceMeters(position, placeCoords(b))) : list,
    [position],
  );

  // Popular: the soonest hangouts, then the nearest places.
  const popularPlaces = useMemo(
    () => [...toPlaces(popular.events.slice(0, 3), []), ...byDistance(toPlaces([], popular.venues))].slice(0, POPULAR_COUNT),
    [popular, byDistance],
  );
  const resultPlaces = useMemo(() => (results ? [...toPlaces(results.events, []), ...byDistance(toPlaces([], results.venues))] : []), [results, byDistance]);
  const showingResults = q.length > 0;

  function remember(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recents.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENTS);
    setRecents(next);
    saveRecents(next);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    remember(query);
  }

  function hrefFor(place: Place) {
    // Places open in the map preview on Home until Venue detail is built.
    return place.kind === "event" ? `/hangouts/${place.event.id}` : `/home?focus=${place.key}`;
  }

  function subtitle(place: Place) {
    if (place.kind === "event") return `${formatDayTime(place.event.startAt)} · ${place.event.addressText}`;
    const { venue } = place;
    const distance = position && formatDistance(distanceMeters(position, placeCoords(place)));
    return [VENUE_CATEGORY_LABEL[venue.category], distance, venue.addressText].filter(Boolean).join(" · ");
  }

  const list = showingResults ? resultPlaces : popularPlaces;
  const loadingResults = showingResults && results?.q !== q;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background px-5 py-4">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card">
          <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} />
        </button>
        <form onSubmit={onSubmit} role="search" className="flex h-[46px] min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg border border-[#f4f4f4] bg-card px-3">
          <Image src="/icons/hangout/search-field.svg" alt="" width={16} height={16} className="shrink-0" />
          <input
            autoFocus
            type="text"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search restaurants, hangouts, lounges..."
            aria-label="Search restaurants, hangouts, lounges"
            maxLength={100}
            className="min-w-0 flex-1 bg-transparent py-2 font-body text-[15px] leading-[22px] text-input-text outline-none placeholder:text-[#7c7c7c]"
          />
        </form>
      </header>

      <main className="flex flex-col gap-5 px-5 pb-8 pt-1">
        {!showingResults && recents.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-body text-[15px] font-bold leading-[22px] text-heading">Recent searches</h2>
              <button
                type="button"
                onClick={() => {
                  setRecents([]);
                  saveRecents([]);
                }}
                className="font-body text-xs text-body-text underline"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {recents.map((r) => (
                <button key={r} type="button" onClick={() => setQuery(r)} className={pill}>
                  {r}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="font-body text-[15px] font-bold leading-[22px] text-heading">{showingResults ? "Results" : "Popular near you"}</h2>
          <ul className="flex flex-col gap-2.5">
            {list.map((place) => {
              const cover = place.kind === "event" ? place.event.coverImageUrl : place.venue.coverImageUrl;
              const title = place.kind === "event" ? place.event.title : place.venue.name;
              return (
                <li key={place.key}>
                  <Link href={hrefFor(place)} onClick={() => remember(query)} className="flex items-center gap-3 rounded-[14px] bg-card p-2.5">
                    <span className="relative flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eef3e9] text-2xl">
                      {cover ? (
                        <Image src={cover} alt="" fill sizes="52px" className="object-cover" unoptimized />
                      ) : (
                        <span aria-hidden>{place.kind === "event" ? "🎉" : VENUE_CATEGORY_EMOJI[place.venue.category]}</span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-body text-base font-bold leading-6 text-heading">{title}</span>
                      <span className="truncate font-body text-xs leading-4 tracking-[0.024px] text-body-text">{subtitle(place)}</span>
                    </span>
                    <Image src="/icons/hangout/chevron.svg" alt="" width={16} height={16} className="shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {loadingResults && <p className="font-body text-sm text-body-text">Searching…</p>}
          {!loadingResults && list.length === 0 && (
            <p className="py-6 text-center font-body text-sm text-body-text">
              {showingResults ? `Nothing found for "${q}".` : "Nothing nearby yet."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

export default function HangoutSearchPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <HangoutSearchContent />
      </RequireCountry>
    </RequireAuth>
  );
}
