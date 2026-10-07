"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { distanceMeters } from "@/features/hangouts/places";
import { RadarPadi } from "@/features/radar/api";
import { PadiCard } from "./PadiCard";

interface PadiCarouselProps {
  padis: RadarPadi[];
  startId: string;
  position: [number, number] | null;
  busyId: string | null;
  onToggleHide: (id: string) => void;
  onAddPadi: (id: string) => void;
  onClose: () => void;
}

// The map dims and a swipeable row of padi cards opens at the tapped pin.
// Mirrors the hangout PreviewCarousel.
export function PadiCarousel({ padis, startId, position, busyId, onToggleHide, onAddPadi, onClose }: PadiCarouselProps) {
  const startRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Padi preview" className="fixed inset-0 z-50 mx-auto flex w-full max-w-[430px] flex-col bg-[rgba(26,26,26,0.45)]">
      <div className="px-5 pt-4" onClick={onClose}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex size-10 items-center justify-center rounded-full border border-border bg-card"
        >
          <Image src="/icons/hangout/close.svg" alt="" width={24} height={24} />
        </button>
      </div>
      {/* Tapping the dimmed map closes the preview. */}
      <div className="flex-1" onClick={onClose} />
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-[17px] pt-2 [scrollbar-width:none]">
        {padis.map((p) => (
          <div key={p.user.id} ref={p.user.id === startId ? startRef : undefined} className="shrink-0 snap-center">
            <PadiCard
              padi={p}
              distanceKm={position ? distanceMeters(position, [p.latitude, p.longitude]) / 1000 : null}
              busy={busyId === p.user.id}
              onToggleHide={() => onToggleHide(p.user.id)}
              onAddPadi={() => onAddPadi(p.user.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
