"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  // Emoji, or short text (initials) when isText is set.
  emoji: string;
  isText?: boolean;
  /** Plain round marker (Figma 304:30666) instead of the teardrop. */
  dot?: boolean;
  label: string;
}

interface LeafletMapProps {
  center: [number, number];
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  // Bumped by the parent whenever the container is resized (e.g. full screen).
  resizeKey: number;
  /** false = a static preview: no dragging, zooming or tapping. */
  interactive?: boolean;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Figma map pin (e.g. node 590:9024): lime teardrop with a dark border,
// rotated 45° so the point faces down, emoji counter-rotated upright.
function pinIcon(pin: MapPin, selected: boolean) {
  if (pin.dot) {
    return L.divIcon({
      className: "",
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      html: '<div style="width:30px;height:30px;background:#d7e600;border:3px solid #1b3b2b;border-radius:999px"></div>',
    });
  }
  const scale = selected ? 1.2 : 1;
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    // Rotating the square 45° swings its sharp corner out to the left
    // (~6.6px past the box edge), as in the design — anchor on that tip.
    iconAnchor: [-6, 16],
    html: `<div style="width:32px;height:32px;transform:rotate(45deg) scale(${scale});background:#d7e600;border:3px solid #1b3b2b;border-radius:999px 999px 999px 4px;box-shadow:0 2px 3px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;transform-origin:center">
      <span style="transform:rotate(-45deg);font-size:${pin.isText ? 10 : 12}px;line-height:12px;font-weight:700;color:#1b3b2b;font-family:var(--font-work-sans),sans-serif">${escapeHtml(pin.emoji)}</span>
    </div>`,
  });
}

export default function LeafletMap({ center, pins, selectedId, onSelect, resizeKey, interactive = true }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      ...(!interactive && { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }),
    }).setView(center, 14);
    // OpenStreetMap's public tiles: fine for development; their usage policy
    // rules out heavy production traffic, so swap in a tile provider (or
    // Google Maps) with a key before launch.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.on("click", () => onSelectRef.current(null));
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create the map once; center changes are handled below
  }, []);

  useEffect(() => {
    mapRef.current?.setView(center, mapRef.current.getZoom());
  }, [center]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [resizeKey]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const pin of pins) {
      L.marker([pin.latitude, pin.longitude], {
        icon: pinIcon(pin, pin.id === selectedId),
        title: pin.label,
        keyboard: interactive,
        interactive,
      })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(pin.id);
        })
        .addTo(layer);
    }
  }, [pins, selectedId, interactive]);

  return <div ref={containerRef} className="size-full" />;
}
