"use client";

import { APIProvider, Map as GMap, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, hasMapsKey } from "@/lib/maps/config";

interface LocationPickerProps {
  /** Where the map should be centred; changing it re-centres the map. */
  center: [number, number];
  /** Called when the user drags the map and it settles. */
  onMove: (lat: number, lng: number) => void;
}

function PickerController({ center, onMove }: LocationPickerProps) {
  const map = useMap();
  const onMoveRef = useRef(onMove);
  const programmatic = useRef(false);
  // Skip the first `idle` (fires on load) so we only report real user pans.
  const settled = useRef(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", () => {
      if (!settled.current) {
        settled.current = true;
        return;
      }
      if (programmatic.current) {
        programmatic.current = false;
        return;
      }
      const c = map.getCenter();
      if (c) onMoveRef.current(c.lat(), c.lng());
    });
    return () => listener.remove();
  }, [map]);

  // Re-centre when the parent changes `center` (e.g. "use my location").
  useEffect(() => {
    if (!map) return;
    const c = map.getCenter();
    if (c && Math.abs(c.lat() - center[0]) < 1e-6 && Math.abs(c.lng() - center[1]) < 1e-6) return;
    programmatic.current = true;
    map.setCenter({ lat: center[0], lng: center[1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recenter on coords only
  }, [center[0], center[1], map]);

  return null;
}

// Figma "Choose location" (377:354): the lime dot stays fixed in the middle and
// the map pans underneath it.
export default function GoogleLocationPicker({ center, onMove }: LocationPickerProps) {
  return (
    <div className="relative isolate size-full">
      {hasMapsKey ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <GMap
            className="size-full"
            mapId={GOOGLE_MAPS_MAP_ID}
            defaultCenter={{ lat: center[0], lng: center[1] }}
            defaultZoom={16}
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
          >
            <PickerController center={center} onMove={onMove} />
          </GMap>
        </APIProvider>
      ) : (
        <div className="flex size-full items-center justify-center bg-[#eef3e9] p-4 text-center">
          <p className="font-body text-xs text-body-text">Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in frontend/.env.local.</p>
        </div>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[500] size-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#1b3b2b] bg-accent"
      />
    </div>
  );
}
