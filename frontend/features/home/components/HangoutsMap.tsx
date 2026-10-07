"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ReactNode, useMemo, useState } from "react";
import { Place } from "@/features/hangouts/places";
import { VENUE_CATEGORY_EMOJI } from "@/features/venues/types";
import type { MapPin } from "./LeafletMap";

// Leaflet touches `window`, so it can only load in the browser.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

interface HangoutsMapProps {
  center: [number, number];
  isUserLocation: boolean;
  places: Place[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onViewList: () => void;
  /** Shown above the map in the full view (Figma 611:9373): the filter pills. */
  filters: ReactNode;
  /** Shown below the map in the full view: the bottom nav. */
  nav: ReactNode;
  /**
   * Figma "Hangout preview" (611:10550): when a pin is tapped the parent passes
   * the swipeable preview cards here. The map goes full-screen with the cards
   * sitting over it, and a close button appears.
   */
  preview?: ReactNode;
  onClosePreview?: () => void;
}

// Figma map block (590:9022 – 590:9059) and its full view (611:9373): "Live
// near you", full-view toggle, "View the list" and the caption beneath.
export function HangoutsMap({ center, isUserLocation, places, selectedKey, onSelect, onViewList, filters, nav, preview, onClosePreview }: HangoutsMapProps) {
  const [fullScreen, setFullScreen] = useState(false);
  const [resizeKey, setResizeKey] = useState(0);

  const pins: MapPin[] = useMemo(
    () =>
      places.map((p) =>
        p.kind === "event"
          ? { id: p.key, latitude: p.event.latitude, longitude: p.event.longitude, emoji: "🎉", label: p.event.title }
          : { id: p.key, latitude: p.venue.latitude, longitude: p.venue.longitude, emoji: VENUE_CATEGORY_EMOJI[p.venue.category], label: p.venue.name },
      ),
    [places],
  );

  function toggleFullScreen() {
    setFullScreen((v) => !v);
    // Let the container resize before Leaflet re-measures.
    requestAnimationFrame(() => setResizeKey((k) => k + 1));
  }

  // A tapped pin opens the preview; the map shows full-screen behind the cards.
  const inPreview = !!preview;
  const showFull = fullScreen || inPreview;

  const map = (
    // `isolate` keeps Leaflet's internal z-indexes (400+) from painting over
    // sheets and overlays.
    <div className={`relative isolate w-full overflow-hidden bg-[#eef3e9] ${showFull ? "flex-1" : "h-[420px] rounded-[18px]"}`}>
      <LeafletMap center={center} pins={pins} selectedId={selectedKey} onSelect={(id) => id && onSelect(id)} resizeKey={resizeKey} />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-start justify-between">
        <span className="flex items-center gap-[5px] rounded-full bg-card px-3 py-1.5 shadow-[0px_2px_4px_rgba(0,0,0,0.1)]">
          <span className="size-[7px] rounded-full bg-live" />
          <span className="font-body text-[11px] font-bold text-heading">{isUserLocation ? "Live near you" : "Victoria Island, Lagos"}</span>
        </span>
        {!inPreview && (
          <button
            type="button"
            onClick={toggleFullScreen}
            aria-label={fullScreen ? "Exit full map" : "Open full map"}
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-card shadow-[0px_2px_4px_rgba(0,0,0,0.12)]"
          >
            <Image src={fullScreen ? "/icons/hangout/collapse.svg" : "/icons/home/expand.svg"} alt="" width={15} height={15} />
          </button>
        )}
      </div>

      {!inPreview && (
        <button
          type="button"
          onClick={onViewList}
          className="absolute bottom-3 left-2.5 z-[500] flex h-11 items-center gap-2 rounded-full bg-ink px-5 shadow-[0px_6px_8px_rgba(0,0,0,0.2)]"
        >
          <Image src="/icons/home/list.svg" alt="" width={15} height={15} />
          <span className="font-body text-[13.5px] font-bold text-white">View the list</span>
        </button>
      )}

      {/* The preview cards float over the bottom of the map (Figma). */}
      {inPreview && <div className="absolute inset-x-0 bottom-3 z-[600]">{preview}</div>}
    </div>
  );

  if (showFull) {
    return (
      <div className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col gap-3 bg-background pt-4">
        {inPreview && (
          <div className="px-5">
            <button
              type="button"
              onClick={onClosePreview}
              aria-label="Close preview"
              className="flex size-10 items-center justify-center rounded-full border border-border bg-card"
            >
              <Image src="/icons/hangout/close.svg" alt="" width={24} height={24} />
            </button>
          </div>
        )}
        <div className="px-5">{filters}</div>
        <div className="flex flex-1 flex-col px-5">{map}</div>
        {!inPreview && <div className="px-5 pb-3">{nav}</div>}
      </div>
    );
  }

  return (
    <section className="flex w-full flex-col gap-2.5">
      {map}
      <p className="text-center font-body text-[12.5px] text-body-text">Tap a pin to see hangout &amp; place details</p>
    </section>
  );
}
