"use client";

import { useEffect, useRef } from "react";
import { EventListItem } from "@/features/events/types";
import { Venue } from "@/features/venues/types";
import { Place, distanceMeters, placeCoords } from "../places";
import { HangoutCard } from "./HangoutCard";

interface PreviewCarouselProps {
  places: Place[];
  startKey: string;
  userId: string | undefined;
  position: [number, number] | null;
  joiningId: string | null;
  onJoin: (eventId: string) => void;
  onToggleFavorite: (venue: Venue) => void;
  onToggleEventFavorite: (event: EventListItem) => void;
  onClose: () => void;
}

// Figma "Hangout preview" (611:10550): a swipeable row of cards that sits over
// the full-screen map at the pin that was tapped. The full-screen map and the
// close button are owned by HangoutsMap; this is just the cards strip.
export function PreviewCarousel({ places, startKey, userId, position, joiningId, onJoin, onToggleFavorite, onToggleEventFavorite, onClose }: PreviewCarouselProps) {
  const startRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-1 pt-1 [scrollbar-width:none]">
      {places.map((place) => (
        <div key={place.key} ref={place.key === startKey ? startRef : undefined} className="shrink-0 snap-center">
          <HangoutCard
            place={place}
            variant="preview"
            userId={userId}
            distance={position ? distanceMeters(position, placeCoords(place)) : undefined}
            joining={place.kind === "event" && joiningId === place.event.id}
            onJoin={onJoin}
            onToggleFavorite={onToggleFavorite}
            onToggleEventFavorite={onToggleEventFavorite}
          />
        </div>
      ))}
    </div>
  );
}
