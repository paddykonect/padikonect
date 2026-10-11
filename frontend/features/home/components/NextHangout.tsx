import Image from "next/image";
import Link from "next/link";
import { EventListItem } from "@/features/events/types";
import { PlusIcon } from "@/features/hangouts/components/icons";
import { goingLabel, rsvpLabel, startBadge } from "@/features/hangouts/places";
import { formatDayTime } from "@/lib/format/time";

interface NextHangoutProps {
  /** The soonest upcoming hangout the user hosts or is going to; null = none. */
  event: EventListItem | null;
  loading: boolean;
  userId: string | undefined;
  /** "View all" opens the full hangout list (the home list view). */
  onViewAll: () => void;
}

// Figma "Home" → "Your next hangout": the card when you have an upcoming hangout,
// or a "host your first one" empty state when you don't.
export function NextHangout({ event, loading, userId, onViewAll }: NextHangoutProps) {
  const status = event ? rsvpLabel(event, userId) : null;
  const badge = event ? startBadge(event.startAt) : null;

  return (
    <section className="flex w-full flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="font-body text-xs font-bold uppercase tracking-[0.48px] text-body-text">Your next hangout</h2>
        {event && (
          <button type="button" onClick={onViewAll} className="font-body text-[13px] font-medium text-heading">
            View all
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-[120px] w-full animate-pulse rounded-2xl bg-card" />
      ) : event ? (
        <Link href={`/hangouts/${event.id}`} className="flex w-full flex-col overflow-hidden rounded-2xl bg-card shadow-[0px_8px_24px_0px_rgba(23,62,50,0.07)]">
          <div className="relative h-[150px] w-full bg-[#eef3e9]">
            {event.coverImageUrl ? (
              <Image src={event.coverImageUrl} alt="" fill sizes="390px" className="object-cover" unoptimized />
            ) : (
              <span className="flex size-full items-center justify-center text-4xl">🎉</span>
            )}
            {badge && (
              <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-[3px] font-body text-xs font-medium text-[#1b3b2b]">{badge}</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 p-3.5">
            <h3 className="font-heading text-base font-bold text-heading">{event.title}</h3>
            <p className="flex items-center gap-1 font-body text-xs text-body-text">
              <Image src="/icons/hangout/calendar.svg" alt="" width={15} height={15} className="shrink-0" />
              <span className="truncate">
                {formatDayTime(event.startAt)} · {event.addressText}
              </span>
            </p>
            <div className="flex items-center justify-between pt-0.5">
              <span className="font-body text-xs text-body-text">{goingLabel(event)}</span>
              {status && <span className="rounded-full bg-ink px-3 py-1 font-body text-xs font-bold text-white">{status}</span>}
            </div>
          </div>
        </Link>
      ) : (
        <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-7 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/25">
            <Image src="/icons/hangout/calendar.svg" alt="" width={20} height={20} />
          </span>
          <p className="font-heading text-base font-bold text-heading">No hangouts yet</p>
          <p className="max-w-[260px] font-body text-[13px] text-body-text">Host a hangout or join one nearby — it&apos;ll show up here once you do.</p>
          <Link href="/hangouts/new" className="mt-1 flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-body text-sm font-bold text-[#1b3b2b]">
            <PlusIcon size={16} />
            Host a hangout
          </Link>
        </div>
      )}
    </section>
  );
}
