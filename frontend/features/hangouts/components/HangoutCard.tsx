import Image from "next/image";
import Link from "next/link";
import { EventListItem } from "@/features/events/types";
import { FavoriteButton } from "@/features/home/components/FavoriteButton";
import { VENUE_CATEGORY_EMOJI, VENUE_CATEGORY_LABEL, Venue } from "@/features/venues/types";
import { formatDayTime } from "@/lib/format/time";
import { Place, directionsUrl, formatDistance, goingLabel, rsvpLabel, startBadge } from "../places";

interface HangoutCardProps {
  place: Place;
  userId: string | undefined;
  /** Metres from the user, when their location is known. */
  distance?: number;
  /** "list" = full-width card (611:10137); "preview" = map carousel card (611:10845). */
  variant?: "list" | "preview";
  joining?: boolean;
  onJoin: (eventId: string) => void;
  onToggleFavorite: (venue: Venue) => void;
  onToggleEventFavorite?: (event: EventListItem) => void;
}

const pill = "rounded-full px-2.5 py-1 font-body text-xs leading-[normal]";
const previewButton = "relative z-10 flex h-[38px] flex-1 items-center justify-center rounded-full px-1.5 font-body text-[13px] font-medium leading-[18px]";

function Cover({ src, fallback, badge }: { src: string | null; fallback: string; badge: string | null }) {
  return (
    <div className="relative flex h-[159px] w-full shrink-0 items-start overflow-hidden rounded-t-xl bg-[#eef3e9] p-2">
      {src ? (
        <Image src={src} alt="" fill sizes="350px" className="object-cover" unoptimized />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-4xl" aria-hidden>
          {fallback}
        </span>
      )}
      {badge && <span className="relative rounded-full bg-accent px-2.5 py-[3px] font-body text-xs font-medium text-[#1b3b2b]">{badge}</span>}
    </div>
  );
}

// Figma "Hangout card" (611:10700). Hangouts link to their detail page; places
// show category · distance · area. The whole card is the link (stretched over
// the title) so its buttons stay separately tappable.
export function HangoutCard({ place, userId, distance, variant = "list", joining, onJoin, onToggleFavorite, onToggleEventFavorite }: HangoutCardProps) {
  const preview = variant === "preview";
  const width = preview ? "w-[269px]" : "w-full";

  if (place.kind === "venue") {
    const { venue } = place;
    // The "Registered lounge" pill already says it; the details line just says Lounge (Figma 611:10197).
    const category = venue.category === "REGISTERED_LOUNGE" && !preview ? "Lounge" : VENUE_CATEGORY_LABEL[venue.category];
    const details = [category, distance !== undefined && formatDistance(distance), venue.addressText].filter(Boolean).join(" · ");
    return (
      <article className={`relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-card pb-4 shadow-[0px_8px_24px_0px_rgba(23,62,50,0.07)] ${width}`}>
        <Cover src={venue.coverImageUrl} fallback={VENUE_CATEGORY_EMOJI[venue.category]} badge={null} />
        <div className="flex w-full flex-col gap-2 px-4">
          <h3 className="font-body text-base font-bold text-heading">
            <Link href={`/venues/${venue.id}`} className="after:absolute after:inset-0">
              {venue.name}
            </Link>
          </h3>
          <p className="truncate font-body text-xs leading-[1.4] text-body-text">{details}</p>
          {!preview && (
            <div className="flex items-center justify-between gap-2">
              {venue.category === "REGISTERED_LOUNGE" ? <span className={`${pill} bg-background text-heading`}>Registered lounge</span> : <span />}
              {/* Figma 611:10065 "+ Host here" on place cards. */}
              <Link
                href={`/hangouts/new?venueId=${venue.id}`}
                className={`${pill} relative z-10 flex items-center gap-1 border border-border bg-card font-medium text-heading`}
              >
                <span aria-hidden>+</span> Host here
              </Link>
            </div>
          )}
          {preview && (
            <div className="flex w-full gap-2">
              <a href={directionsUrl(venue.latitude, venue.longitude)} target="_blank" rel="noreferrer" className={`${previewButton} border border-border bg-card text-heading`}>
                Get direction
              </a>
            </div>
          )}
        </div>
        <div className="absolute right-1 top-1 z-10">
          <FavoriteButton favorite={venue.isFavorite} label={venue.name} onToggle={() => onToggleFavorite(venue)} />
        </div>
      </article>
    );
  }

  const { event } = place;
  const status = rsvpLabel(event, userId);
  const join = (
    <button
      type="button"
      onClick={() => onJoin(event.id)}
      disabled={joining}
      className={preview ? `${previewButton} bg-accent text-[#1b3b2b] disabled:opacity-60` : `${pill} relative z-10 bg-primary font-medium text-[#1b3b2b] disabled:opacity-60`}
    >
      {joining ? "Joining…" : "Join"}
    </button>
  );
  const statusPill = status && (
    <span
      className={`${pill} font-medium ${status === "Going" || status === "Hosting" ? "bg-ink text-white" : "bg-toggle-bg text-heading"} ${
        preview ? "flex h-[38px] flex-1 items-center justify-center text-[13px]" : ""
      }`}
    >
      {status}
    </span>
  );

  return (
    <article className={`relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-card pb-4 shadow-[0px_8px_24px_0px_rgba(23,62,50,0.07)] ${width}`}>
      <Cover src={event.coverImageUrl} fallback="🎉" badge={startBadge(event.startAt)} />
      <div className="flex w-full flex-col gap-2 px-4">
        <h3 className="font-body text-base font-bold text-heading">
          <Link href={`/hangouts/${event.id}`} className="after:absolute after:inset-0">
            {event.title}
          </Link>
        </h3>
        <p className="flex items-center gap-1 font-body text-xs leading-[1.4] text-body-text">
          <Image src="/icons/hangout/calendar.svg" alt="" width={16} height={16} className="shrink-0" />
          <span className="truncate">
            {formatDayTime(event.startAt)} · {event.addressText}
          </span>
        </p>
        <div className="flex w-full items-start justify-between">
          <span className={`${pill} bg-background text-heading`}>{goingLabel(event)}</span>
          {!preview && (statusPill || join)}
        </div>
        {preview && (
          <div className="flex w-full gap-2">
            <a href={directionsUrl(event.latitude, event.longitude)} target="_blank" rel="noreferrer" className={`${previewButton} border border-border bg-card text-heading`}>
              Get direction
            </a>
            {statusPill || join}
          </div>
        )}
      </div>
      {onToggleEventFavorite && (
        <div className="absolute right-1 top-1 z-10">
          <FavoriteButton favorite={event.isFavorite} label={event.title} onToggle={() => onToggleEventFavorite(event)} />
        </div>
      )}
    </article>
  );
}
