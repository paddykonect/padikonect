"use client";

import { APIProvider, AdvancedMarker, Map as GMap, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, hasMapsKey } from "@/lib/maps/config";

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  // Emoji, or short text (initials) when isText is set.
  emoji: string;
  isText?: boolean;
  /** Plain round marker (Figma 304:30666) instead of the teardrop. */
  dot?: boolean;
  /** Padi photo pin — a round profile picture (falls back to initials). */
  photoUrl?: string | null;
  /** Shows a green presence dot on a photo pin. */
  online?: boolean;
  label: string;
}

interface GoogleMapProps {
  center: [number, number];
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  // Bumped by the parent whenever the container is resized (e.g. full screen).
  resizeKey: number;
  /** false = a static preview: no dragging, zooming or tapping. */
  interactive?: boolean;
}

// Figma map pin: lime teardrop with a dark border; the tip points down to the
// coordinate. The emoji/initials sit upright in the middle. `dot` pins are a
// plain lime circle centred on the point.
function PinMarker({ pin, selected }: { pin: MapPin; selected: boolean }) {
  // Padi photo pin: a round profile picture centred on the point, with an
  // optional green presence dot. Falls back to the teardrop when no photo.
  if (pin.photoUrl) {
    const d = selected ? 46 : 38;
    return (
      <span className="relative block" style={{ transform: "translateY(50%)" }}>
        <span
          className="block overflow-hidden rounded-full border-[3px] border-white bg-[#eef3e9] shadow-[0_2px_5px_rgba(0,0,0,.35)]"
          style={{ width: d, height: d, outline: selected ? "2px solid #c6f135" : undefined, outlineOffset: 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin.photoUrl} alt={pin.label} className="size-full object-cover" referrerPolicy="no-referrer" />
        </span>
        {pin.online && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-live" />}
      </span>
    );
  }
  if (pin.dot) {
    return (
      <span
        style={{ transform: "translateY(50%)" }}
        className="block size-[26px] rounded-full border-[3px] border-[#1b3b2b] bg-accent shadow-[0_2px_3px_rgba(0,0,0,.18)]"
      />
    );
  }
  return (
    <span className="relative block size-[34px]" style={{ transform: `scale(${selected ? 1.15 : 1})`, transformOrigin: "50% 100%" }}>
      <span
        className="absolute inset-0 border-[3px] border-[#1b3b2b] bg-accent shadow-[0_2px_3px_rgba(0,0,0,.25)]"
        style={{ borderRadius: "50% 50% 50% 0", transform: "rotate(45deg)" }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-body font-bold text-[#1b3b2b]"
        style={{ fontSize: pin.isText ? 10 : 13, lineHeight: "12px" }}
      >
        {pin.emoji}
      </span>
    </span>
  );
}

// Recentres the map when `center` changes (preserving zoom) and nudges it when
// the container resizes — mirrors the old Leaflet setView/invalidateSize.
function MapController({ center, resizeKey }: { center: [number, number]; resizeKey: number }) {
  const map = useMap();
  useEffect(() => {
    map?.setCenter({ lat: center[0], lng: center[1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recenter on these two only
  }, [center[0], center[1], resizeKey]);
  return null;
}

export default function GoogleMap({ center, pins, selectedId, onSelect, resizeKey, interactive = true }: GoogleMapProps) {
  if (!hasMapsKey) {
    return (
      <div className="flex size-full items-center justify-center bg-[#eef3e9] p-4 text-center">
        <p className="font-body text-xs text-body-text">Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in frontend/.env.local.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <GMap
        className="size-full"
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={{ lat: center[0], lng: center[1] }}
        defaultZoom={14}
        gestureHandling={interactive ? "greedy" : "none"}
        disableDefaultUI
        clickableIcons={false}
        onClick={interactive ? () => onSelect(null) : undefined}
      >
        <MapController center={center} resizeKey={resizeKey} />
        {pins.map((pin) => (
          <AdvancedMarker
            key={pin.id}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            title={pin.label}
            zIndex={pin.id === selectedId ? 1000 : undefined}
          >
            {/* Handle the tap on the pin's own DOM and stop it bubbling to the
                map, whose click would otherwise immediately clear the selection. */}
            <div
              style={{ cursor: interactive ? "pointer" : "default" }}
              onClick={interactive ? (e) => { e.stopPropagation(); onSelect(pin.id); } : undefined}
            >
              <PinMarker pin={pin} selected={pin.id === selectedId} />
            </div>
          </AdvancedMarker>
        ))}
      </GMap>
    </APIProvider>
  );
}
