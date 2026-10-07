"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

interface LocationPickerMapProps {
  /** Where the map should be centred; changing it re-centres the map. */
  center: [number, number];
  /** Called when the user drags the map and it settles. */
  onMove: (lat: number, lng: number) => void;
}

// Figma "Choose location" (377:354): the lime dot stays fixed in the middle
// and the map pans underneath it.
export default function LocationPickerMap({ center, onMove }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onMoveRef = useRef(onMove);
  // Moves we started ourselves (re-centring) shouldn't report back.
  const programmatic = useRef(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(center, 16);
    // Same OSM tiles as LeafletMap (dev only — see the note there).
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("moveend", () => {
      if (programmatic.current) {
        programmatic.current = false;
        return;
      }
      const c = map.getCenter();
      onMoveRef.current(c.lat, c.lng);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once; center changes handled below
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - center[0]) < 1e-6 && Math.abs(c.lng - center[1]) < 1e-6) return;
    programmatic.current = true;
    map.setView(center, map.getZoom());
  }, [center]);

  return (
    <div className="relative isolate size-full">
      <div ref={containerRef} className="size-full" />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 z-[500] size-[30px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#1b3b2b] bg-accent"
      />
    </div>
  );
}
