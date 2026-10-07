"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { distanceMeters } from "@/features/hangouts/places";
import * as padisApi from "@/features/padis/api";
import { PadiListItem } from "@/features/padis/types";
import * as radarApi from "@/features/radar/api";
import { RadarPadi } from "@/features/radar/api";
import { PadiCarousel } from "./PadiCarousel";
import type { MapPin } from "./LeafletMap";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

const REFRESH_MS = 2 * 60 * 1000;
const WALKING_DISTANCE_METERS = 2000;

type PadiFilter = "walking" | "online";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000, maximumAge: 60_000 });
  });
}

interface PadisPanelProps {
  accessToken: string;
  center: [number, number];
  position: [number, number] | null;
  nav: ReactNode;
}

// "Padis" side of Home's Hangouts/Padis toggle (PadiRadar). A map of padis
// sharing nearby that expands full-screen; tapping a pin opens a swipeable
// carousel of cards; "View the list" swaps to a filterable list. Sharing is
// opt-in and only visible to people you've added as padis.
export function PadisPanel({ accessToken, center, position, nav }: PadisPanelProps) {
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [nearby, setNearby] = useState<RadarPadi[]>([]);
  // The map/carousel show padis sharing a live location (nearby); the list
  // shows all your padis, online or offline (allPadis).
  const [allPadis, setAllPadis] = useState<PadiListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [resizeKey, setResizeKey] = useState(0);
  const [filters, setFilters] = useState<Set<PadiFilter>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    radarApi.listRadarPadis(accessToken).then(setNearby).catch(() => undefined);
    padisApi.listPadiDirectory(accessToken).then(setAllPadis).catch(() => undefined);
  }, [accessToken]);

  useEffect(() => {
    radarApi
      .getRadarStatus(accessToken)
      .then((s) => setSharing(s.sharing))
      .catch(() => setSharing(false));
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [accessToken, refresh]);

  // While sharing and on this screen, keep your location fresh.
  useEffect(() => {
    if (!sharing) return;
    const push = () =>
      currentPosition()
        .then((p) => radarApi.shareLocation(accessToken, p.coords.latitude, p.coords.longitude))
        .catch(() => undefined);
    const timer = setInterval(push, REFRESH_MS);
    return () => clearInterval(timer);
  }, [sharing, accessToken]);

  async function toggleSharing() {
    setBusy(true);
    setError(null);
    try {
      if (sharing) {
        await radarApi.stopSharing(accessToken);
        setSharing(false);
      } else {
        const p = await currentPosition().catch(() => {
          throw new Error("Allow location access to share where you are.");
        });
        await radarApi.shareLocation(accessToken, p.coords.latitude, p.coords.longitude);
        setSharing(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const patch = (id: string, change: Partial<RadarPadi>) =>
    setNearby((list) => list.map((p) => (p.user.id === id ? { ...p, ...change } : p)));

  async function toggleHide(id: string) {
    const padi = nearby.find((p) => p.user.id === id);
    if (!padi) return;
    const next = !padi.hiddenFromThem;
    setActioningId(id);
    setError(null);
    patch(id, { hiddenFromThem: next });
    try {
      await (next ? radarApi.hidePadi(accessToken, id) : radarApi.unhidePadi(accessToken, id));
    } catch {
      patch(id, { hiddenFromThem: !next });
      setError("Couldn't update who can see you. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  async function addPadi(id: string) {
    setActioningId(id);
    setError(null);
    patch(id, { isPadi: true });
    try {
      await padisApi.addPadi(accessToken, id);
      refresh(); // the new padi now belongs in the directory list
    } catch {
      patch(id, { isPadi: false });
      setError("Couldn't add padi. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  function toggleFullScreen() {
    setFullScreen((v) => !v);
    requestAnimationFrame(() => setResizeKey((k) => k + 1));
  }

  function toggleFilter(id: PadiFilter) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered = useMemo(
    () =>
      nearby.filter(
        (p) =>
          (!filters.has("online") || p.user.online) &&
          (!filters.has("walking") || !position || distanceMeters(position, [p.latitude, p.longitude]) <= WALKING_DISTANCE_METERS),
      ),
    [nearby, filters, position],
  );

  const pins: MapPin[] = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.user.id,
        latitude: p.latitude,
        longitude: p.longitude,
        emoji: initials(p.user.displayName),
        isText: true,
        label: p.user.displayName,
      })),
    [filtered],
  );

  // The list shows all padis (online/offline); only those sharing a fresh
  // location carry coordinates, so distance + Walking distance apply to them.
  const kmOf = (lat: number | null, lng: number | null) =>
    position != null && lat != null && lng != null ? distanceMeters(position, [lat, lng]) / 1000 : null;

  const allFiltered = useMemo(
    () =>
      allPadis.filter(
        (p) =>
          (!filters.has("online") || p.user.online) &&
          (!filters.has("walking") ||
            (position != null && p.latitude != null && p.longitude != null && distanceMeters(position, [p.latitude, p.longitude]) <= WALKING_DISTANCE_METERS)),
      ),
    [allPadis, filters, position],
  );

  const filterPills = (
    <div className="flex gap-2">
      {([
        ["walking", "Walking distance"],
        ["online", "Online now"],
      ] as [PadiFilter, string][]).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={filters.has(id)}
          onClick={() => toggleFilter(id)}
          className={`h-9 rounded-full px-4 font-body text-[13px] font-medium ${
            filters.has(id) ? "bg-ink text-white" : "border border-border bg-card text-heading"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const mapEl = (
    <div className={`relative isolate w-full overflow-hidden bg-[#eef3e9] ${fullScreen ? "flex-1" : "h-[320px] rounded-[18px]"}`}>
      <LeafletMap center={center} pins={pins} selectedId={selectedId} onSelect={(id) => id && setSelectedId(id)} resizeKey={resizeKey} />
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-start justify-between">
        <span className="flex items-center gap-[5px] rounded-full bg-white px-3 py-1.5 shadow-[0px_2px_4px_rgba(0,0,0,0.1)]">
          <span className="size-[7px] rounded-full bg-live" />
          <span className="font-body text-[11px] font-bold text-[#1b3b2b]">
            {filtered.length === 0 ? "No padis sharing right now" : `${filtered.length} padi${filtered.length === 1 ? "" : "s"} nearby`}
          </span>
        </span>
        <button
          type="button"
          onClick={toggleFullScreen}
          aria-label={fullScreen ? "Exit full map" : "Open full map"}
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-white shadow-[0px_2px_4px_rgba(0,0,0,0.12)]"
        >
          <Image src={fullScreen ? "/icons/hangout/collapse.svg" : "/icons/home/expand.svg"} alt="" width={15} height={15} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setFullScreen(false);
          setListMode(true);
        }}
        className="absolute bottom-3 left-2.5 z-[500] flex h-11 items-center gap-2 rounded-full bg-ink px-5 shadow-[0px_6px_8px_rgba(0,0,0,0.2)]"
      >
        <Image src="/icons/home/list.svg" alt="" width={15} height={15} />
        <span className="font-body text-[13.5px] font-bold text-white">View the list</span>
      </button>
    </div>
  );

  const carousel = selectedId && filtered.some((p) => p.user.id === selectedId) && (
    <PadiCarousel
      padis={filtered}
      startId={selectedId}
      position={position}
      busyId={actioningId}
      onToggleHide={(id) => void toggleHide(id)}
      onAddPadi={(id) => void addPadi(id)}
      onClose={() => setSelectedId(null)}
    />
  );

  if (fullScreen) {
    return (
      <>
        <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col gap-4 bg-background pt-4">
          <div className="px-5">{filterPills}</div>
          <div className="flex flex-1 flex-col px-5">{mapEl}</div>
          <div className="px-5 pb-3">{nav}</div>
        </div>
        {carousel}
      </>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {!listMode && (
        <div className="flex items-center gap-3 rounded-2xl bg-card p-3.5">
          <div className="min-w-0 flex-1">
            <p className="font-body text-sm font-bold text-heading">Share my location with padis</p>
            <p className="font-body text-xs text-body-text">Only people you&apos;ve added can see you, roughly (~100m). Off by default.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!sharing}
            aria-label="Share my location with padis"
            disabled={sharing === null || busy}
            onClick={() => void toggleSharing()}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${sharing ? "bg-ink" : "bg-border"}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${sharing ? "left-6" : "left-1"}`} />
          </button>
        </div>
      )}

      {error && <p className="font-body text-sm text-danger">{error}</p>}

      {listMode ? (
        <>
          {filterPills}
          {allFiltered.length === 0 ? (
            <div className="flex w-full flex-col items-center gap-2 rounded-[18px] border border-dashed border-border px-6 py-10 text-center">
              <p className="font-heading text-lg font-bold text-heading">
                {allPadis.length === 0 ? "No padis yet" : "No padis match these filters"}
              </p>
              <p className="font-body text-[13px] text-body-text">
                {allPadis.length === 0
                  ? "Join a hangout or scan a padi's code to start building your circle."
                  : "Try turning a filter off."}
              </p>
            </div>
          ) : (
            <ul className="flex w-full flex-col rounded-[18px] bg-card px-4">
              {allFiltered.map((p) => {
                const d = kmOf(p.latitude, p.longitude);
                return (
                  <li key={p.user.id} className="border-b border-border-subtle last:border-b-0">
                    <Link href={`/padi/${p.user.id}`} className="flex items-center gap-3 py-3">
                      <span className="relative shrink-0">
                        <Avatar name={p.user.displayName} photoUrl={p.user.photoUrl} size={44} />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${p.user.online ? "bg-live" : "bg-border"}`}
                          aria-label={p.user.online ? "Online" : "Offline"}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-body text-sm font-bold text-heading">{p.user.displayName}</span>
                          <span className="shrink-0 font-body text-xs text-body-text">
                            {d != null ? `${d.toFixed(1)}km` : p.user.online ? "Online" : "Offline"}
                            {p.ratingCount > 0 && ` · ★ ${p.ratingAvg?.toFixed(1)}`}
                          </span>
                        </span>
                        <span className="block truncate font-body text-xs text-body-text">
                          {p.user.wantsToBeInvitedFor ?? (p.user.online ? "Online now" : "Offline")}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setListMode(false)}
              className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 shadow-[0px_6px_8px_rgba(0,0,0,0.2)]"
            >
              <Image src="/icons/hangout/map.svg" alt="" width={15} height={15} />
              <span className="font-body text-[13.5px] font-bold text-white">View on map</span>
            </button>
          </div>
        </>
      ) : (
        <section className="flex w-full flex-col gap-2.5">
          {mapEl}
          <p className="text-center font-body text-[12.5px] text-body-text">Tap a padi to see their details</p>
        </section>
      )}

      {carousel}
    </div>
  );
}
