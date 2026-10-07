import Image from "next/image";
import Link from "next/link";
import { EventListItem } from "@/features/events/types";
import { Venue, VENUE_CATEGORY_LABEL } from "@/features/venues/types";
import { formatDayTime } from "@/lib/format/time";
import { FavoriteButton } from "./FavoriteButton";

interface FavoritesRowProps {
  venues: Venue[];
  events: EventListItem[];
  onToggleFavorite: (venue: Venue) => void;
  onToggleEventFavorite: (event: EventListItem) => void;
}

const card = "relative flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl bg-card";
const cover = "relative h-[84px] w-full bg-border-subtle";
const body = "flex flex-col items-start gap-[7px] px-2.5 pb-[9px] pt-2.5";
const title = "w-full truncate font-body text-sm font-bold text-heading";
const tag = "rounded-full bg-background px-2 py-0.5 font-body text-[11px] text-heading";

// Figma node 590:8945 ("FAVORITES"): 160px cards scrolling horizontally. Holds
// both saved hangouts and saved places.
export function FavoritesRow({ venues, events, onToggleFavorite, onToggleEventFavorite }: FavoritesRowProps) {
  return (
    <section className="flex w-full flex-col gap-2.5">
      <h2 className="font-body text-xs font-bold uppercase tracking-[0.48px] text-body-text">Favorites</h2>
      {venues.length === 0 && events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center font-body text-[13px] text-body-text">
          No favourites yet. Tap a pin on the map and hit ♥ to save a hangout or place here.
        </p>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {events.map((event) => (
            <article key={`event-${event.id}`} className={card}>
              <div className={cover}>
                {event.coverImageUrl ? (
                  <Image src={event.coverImageUrl} alt="" fill sizes="160px" className="object-cover" unoptimized />
                ) : (
                  <span className="flex size-full items-center justify-center text-2xl">🎉</span>
                )}
              </div>
              <div className={body}>
                <h3 className={title}>
                  <Link href={`/hangouts/${event.id}`} className="after:absolute after:inset-0">
                    {event.title}
                  </Link>
                </h3>
                <span className={tag}>{formatDayTime(event.startAt)}</span>
              </div>
              <div className="absolute right-[5px] top-1 z-10">
                <FavoriteButton favorite={event.isFavorite} label={event.title} onToggle={() => onToggleEventFavorite(event)} />
              </div>
            </article>
          ))}
          {venues.map((venue) => (
            <article key={`venue-${venue.id}`} className={card}>
              <div className={cover}>{venue.coverImageUrl && <Image src={venue.coverImageUrl} alt="" fill sizes="160px" className="object-cover" />}</div>
              <div className={body}>
                <h3 className={title}>
                  <Link href={`/venues/${venue.id}`} className="after:absolute after:inset-0">
                    {venue.name}
                  </Link>
                </h3>
                <span className={tag}>{VENUE_CATEGORY_LABEL[venue.category]}</span>
              </div>
              <div className="absolute right-[5px] top-1 z-10">
                <FavoriteButton favorite={venue.isFavorite} label={venue.name} onToggle={() => onToggleFavorite(venue)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
