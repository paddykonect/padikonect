"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/auth-context";
import { RequireAuth } from "@/features/auth/require-auth";
import * as eventsApi from "@/features/events/api";
import { EventListItem } from "@/features/events/types";
import { ScreenMessage } from "@/features/hangouts/components/FlowScreen";
import { HangoutCard } from "@/features/hangouts/components/HangoutCard";
import { CheckIcon, ClockIcon, CopyIcon, PhoneIcon, PinIcon, PlusIcon, SendIcon, ShareIcon, StarIcon } from "@/features/hangouts/components/icons";
import { directionsUrl, distanceMeters, formatDistance, getGrantedPosition } from "@/features/hangouts/places";
import { FavoriteButton } from "@/features/home/components/FavoriteButton";
import { RequireCountry } from "@/features/profile/require-country";
import * as venuesApi from "@/features/venues/api";
import { VENUE_CATEGORY_EMOJI, VENUE_CATEGORY_LABEL, VenueDetail } from "@/features/venues/types";
import { ApiError } from "@/lib/api/client";
import { formatPhone } from "@/lib/format/phone";

const LeafletMap = dynamic(() => import("@/features/home/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eef3e9]" />,
});

type Tab = "overview" | "menu" | "reviews" | "events";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "menu", label: "Menu" },
  { id: "reviews", label: "Reviews" },
  { id: "events", label: "Events" },
];

const roundButton = "flex size-9 items-center justify-center rounded-full bg-card/90 text-heading";

/** ₦4,500 */
function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

/** "11:00 PM" from "23:00". */
function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" });
}

/** "Open now · Closes 11:00 PM" / "Closed · Opens 12:00 PM", in Lagos time (UTC+1, no DST). */
function hoursLabel(opensAt: string | null, closesAt: string | null, now: Date): string | null {
  if (!opensAt || !closesAt) return null;
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  const minutes = lagos.getUTCHours() * 60 + lagos.getUTCMinutes();
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const open = toMin(opensAt);
  const close = toMin(closesAt);
  // Overnight hours (e.g. 16:00–02:00) wrap past midnight.
  const isOpen = open < close ? minutes >= open && minutes < close : minutes >= open || minutes < close;
  return isOpen ? `Open now · Closes ${clock(closesAt)}` : `Closed · Opens ${clock(opensAt)}`;
}

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="flex" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={n <= Math.round(value)} />
      ))}
    </span>
  );
}

function timeAgo(iso: string, now: Date) {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewSheet({ venue, open, onClose, onSaved }: { venue: VenueDetail; open: boolean; onClose: () => void; onSaved: () => void }) {
  const { accessToken } = useAuth();
  const [rating, setRating] = useState(venue.myReview?.rating ?? 0);
  const [body, setBody] = useState(venue.myReview?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await venuesApi.reviewVenue(accessToken, venue.id, { rating, body: body.trim() });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={venue.myReview ? "Edit your review" : "Write a review"}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(n)}>
              <StarIcon size={32} filled={n <= rating} />
            </button>
          ))}
        </div>
        <textarea
          value={body}
          maxLength={500}
          rows={4}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`What was ${venue.name} like?`}
          className="resize-none rounded-field border border-border bg-card px-4 py-3 font-body text-[15px] text-input-text outline-none placeholder:text-body-text"
        />
        {error && <p className="font-body text-sm text-danger">{error}</p>}
        <Button disabled={rating === 0 || body.trim().length < 3} loading={saving} onClick={() => void save()}>
          Post review
        </Button>
      </div>
    </BottomSheet>
  );
}

// Figma "Venue detail / Overview" (407:4367), "/ Menu" (407:4750),
// "/ Review" (419:5387) and "/ Events" (419:5052).
function VenueDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, user } = useAuth();
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [photo, setPhoto] = useState(0);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function load() {
    if (!accessToken) return;
    venuesApi
      .getVenue(accessToken, id)
      .then(setVenue)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load this place."));
    eventsApi
      .listEvents(accessToken, { venueId: id })
      .then((page) => setEvents(page.items))
      .catch(() => undefined);
  }

  useEffect(load, [accessToken, id]);

  useEffect(() => {
    void getGrantedPosition().then(setPosition);
    // The clock is read on the client only (open-now, review ages).
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const photos = useMemo(() => {
    if (!venue) return [];
    const list = venue.photos.length ? venue.photos : venue.coverImageUrl ? [venue.coverImageUrl] : [];
    return list;
  }, [venue]);

  if (!venue) return <ScreenMessage text={error ?? "Loading…"} onBack={error ? () => router.back() : undefined} />;

  const area = venue.addressText.split(",").slice(-2, -1)[0]?.trim() ?? venue.addressText;
  const details = [VENUE_CATEGORY_LABEL[venue.category], position && formatDistance(distanceMeters(position, [venue.latitude, venue.longitude])), area]
    .filter(Boolean)
    .join(" · ");
  const hours = now && hoursLabel(venue.opensAt, venue.closesAt, now);
  const nextEvent = events.find((e) => e.host.id !== user?.id && !e.myRsvpStatus);

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast("Couldn't copy. Please try again.");
    }
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: venue!.name, url }).catch(() => undefined);
    else await copy(url, "Link copied");
  }

  async function toggleFavorite() {
    if (!accessToken || !venue) return;
    const favorite = !venue.isFavorite;
    setVenue({ ...venue, isFavorite: favorite });
    try {
      await venuesApi.setFavorite(accessToken, venue.id, favorite);
    } catch {
      setVenue((v) => v && { ...v, isFavorite: !favorite });
      setToast("Couldn't update favourites.");
    }
  }

  async function join(eventId: string) {
    if (!accessToken) return;
    setJoiningId(eventId);
    try {
      const rsvp = await eventsApi.joinEvent(accessToken, eventId);
      setEvents((list) => list.map((e) => (e.id === eventId ? { ...e, myRsvpStatus: rsvp.status } : e)));
      setToast(rsvp.status === "APPROVED" ? "You're going 🎉" : "Request sent");
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : "Couldn't send your request.");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background">
      <div className="relative h-[348px] w-full shrink-0 overflow-hidden bg-[#eef3e9]">
        {photos.length ? (
          <Image src={photos[photo]} alt="" fill sizes="430px" className="object-cover" unoptimized priority />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-6xl" aria-hidden>
            {VENUE_CATEGORY_EMOJI[venue.category]}
          </span>
        )}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4">
          <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))} aria-label="Back" className={roundButton}>
            <Image src="/icons/chevron-left.svg" alt="" width={16} height={16} />
          </button>
          <div className="flex items-center gap-2">
            <FavoriteButton favorite={venue.isFavorite} label={venue.name} onToggle={() => void toggleFavorite()} />
            <button type="button" onClick={() => void share()} aria-label="Share place" className={roundButton}>
              <ShareIcon size={16} />
            </button>
          </div>
        </div>
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => setPhoto((p) => (p - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 z-10 -translate-y-1/2 p-2 text-2xl text-white drop-shadow">
              ‹
            </button>
            <button type="button" aria-label="Next photo" onClick={() => setPhoto((p) => (p + 1) % photos.length)} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 p-2 text-2xl text-white drop-shadow">
              ›
            </button>
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <span key={i} className={`size-1.5 rounded-full ${i === photo ? "bg-accent" : "bg-white/70"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-28 pt-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-bold leading-8 text-heading">{venue.name}</h1>
          <p className="font-body text-[13px] text-body-text">{details}</p>
          <p className="flex items-center gap-1.5 font-body text-[13px] text-body-text">
            <StarIcon size={16} />
            {venue.rating.average !== null ? (
              <>
                <span className="font-bold text-heading">{venue.rating.average.toFixed(1)}</span>({venue.rating.count} review{venue.rating.count === 1 ? "" : "s"})
              </>
            ) : (
              "No reviews yet"
            )}
          </p>
        </div>

        <div role="tablist" className="flex rounded-full border border-border bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-9 flex-1 rounded-full font-body text-[13px] font-bold ${tab === t.id ? "bg-ink text-white" : "text-heading"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {venue.description && <p className="font-body text-sm leading-6 text-heading">{venue.description}</p>}
            <section className="flex flex-col overflow-hidden rounded-2xl bg-card">
              <div className="relative isolate h-[175px] w-full">
                <LeafletMap
                  center={[venue.latitude, venue.longitude]}
                  pins={[{ id: venue.id, latitude: venue.latitude, longitude: venue.longitude, emoji: VENUE_CATEGORY_EMOJI[venue.category], label: venue.name }]}
                  selectedId={null}
                  onSelect={() => undefined}
                  resizeKey={0}
                  interactive={false}
                />
              </div>
              <p className="flex items-center gap-2 px-3 pt-3 font-body text-[13px] text-heading">
                <PinIcon size={16} className="shrink-0" />
                {venue.addressText}
              </p>
              <div className="flex items-center gap-2 p-3">
                <a
                  href={directionsUrl(venue.latitude, venue.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-full bg-accent font-body text-[13px] font-bold text-[#1b3b2b]"
                >
                  <SendIcon size={18} />
                  Get directions
                </a>
                <button
                  type="button"
                  onClick={() => void copy(venue.addressText, "Address copied")}
                  aria-label="Copy address"
                  className="flex size-[42px] shrink-0 items-center justify-center rounded-full border border-border-subtle bg-card text-heading"
                >
                  <CopyIcon size={16} />
                </button>
              </div>
            </section>
            {venue.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {venue.amenities.map((a) => (
                  <span key={a} className="rounded-full bg-border-subtle px-3 py-1.5 font-body text-[13px] text-heading">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {(hours || venue.phone) && (
              <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-4 font-body text-sm text-heading">
                {hours && (
                  <p className="flex items-center gap-2.5">
                    <ClockIcon size={18} />
                    {hours}
                  </p>
                )}
                {venue.phone && (
                  <a href={`tel:${venue.phone}`} className="flex items-center gap-2.5">
                    <PhoneIcon size={18} />
                    {formatPhone(venue.phone)}
                  </a>
                )}
              </section>
            )}
          </>
        )}

        {tab === "menu" &&
          (venue.menu.length === 0 ? (
            <p className="font-body text-sm text-body-text">This place hasn&apos;t shared its menu yet.</p>
          ) : (
            venue.menu.map((section) => (
              <section key={section.section} className="flex flex-col gap-2">
                <h2 className="font-body text-[13px] font-bold uppercase tracking-[0.39px] text-body-text">{section.section}</h2>
                <ul className="flex flex-col rounded-2xl bg-card">
                  {section.items.map((item, i) => (
                    <li key={item.id} className={`flex justify-between gap-4 px-4 py-3.5 font-body text-[15px] text-heading ${i > 0 ? "border-t border-divider" : ""}`}>
                      <span>{item.name}</span>
                      <span className="text-body-text">{naira(item.priceKobo)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ))}

        {tab === "reviews" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold text-heading">Reviews</h2>
              <button type="button" onClick={() => setReviewOpen(true)} className="rounded-full bg-accent px-3 py-1 font-body text-xs font-bold text-[#1b3b2b]">
                {venue.myReview ? "Edit your review" : "Write a review"}
              </button>
            </div>
            {venue.rating.average !== null && (
              <section className="flex items-center gap-3 rounded-2xl bg-card p-4">
                <span className="font-heading text-2xl font-bold text-heading">{venue.rating.average.toFixed(1)}</span>
                <div>
                  <Stars value={venue.rating.average} />
                  <p className="font-body text-xs text-body-text">
                    Based on {venue.rating.count} review{venue.rating.count === 1 ? "" : "s"}
                  </p>
                </div>
              </section>
            )}
            {venue.reviews.length === 0 && <p className="font-body text-sm text-body-text">No reviews yet. Been here? Be the first.</p>}
            {venue.reviews.map((r) => {
              const name = r.user.displayName ?? "Padi";
              return (
                <article key={r.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
                  <div className="flex items-center gap-3 border-b border-divider pb-3">
                    <Avatar name={name} photoUrl={r.user.photoUrl} size={44} />
                    <div>
                      <p className="font-body text-[15px] text-heading">{name}</p>
                      <p className="flex items-center gap-1 font-body text-[13px] text-body-text">
                        {now ? timeAgo(r.createdAt, now) : ""} · {r.rating}
                        <StarIcon size={13} />
                      </p>
                    </div>
                  </div>
                  <p className="font-body text-[13px] leading-5 text-heading">{r.body}</p>
                </article>
              );
            })}
          </>
        )}

        {tab === "events" &&
          (events.length === 0 ? (
            <p className="font-body text-sm text-body-text">No upcoming hangouts here yet. Host one!</p>
          ) : (
            events.map((e) => (
              <HangoutCard
                key={e.id}
                place={{ kind: "event", key: e.id, event: e }}
                userId={user?.id}
                joining={joiningId === e.id}
                onJoin={(eventId) => void join(eventId)}
                onToggleFavorite={() => undefined}
              />
            ))
          ))}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[430px] gap-2 border-t border-border-subtle bg-background px-4 pb-6 pt-3">
        <Link
          href={`/hangouts/new?venueId=${venue.id}`}
          className="flex h-[48px] flex-1 items-center justify-center gap-2 rounded-full border border-border bg-card font-body text-sm font-medium text-heading"
        >
          <PlusIcon size={16} />
          Host here
        </Link>
        {nextEvent && (
          <Link href={`/hangouts/${nextEvent.id}`} className="flex h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-accent font-body text-sm font-bold text-[#1b3b2b]">
            <CheckIcon size={16} />
            Join event
          </Link>
        )}
      </div>

      <ReviewSheet
        key={venue.myReview ? `${venue.myReview.rating}:${venue.myReview.body}` : "new"}
        venue={venue}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSaved={() => {
          setReviewOpen(false);
          setToast("Thanks for your review!");
          load();
        }}
      />

      <p aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
        {toast && <span className="rounded-full bg-ink px-4 py-2 font-body text-[13px] text-white shadow-lg">{toast}</span>}
      </p>
    </div>
  );
}

export default function VenueDetailPage() {
  return (
    <RequireAuth>
      <RequireCountry>
        <VenueDetailContent />
      </RequireCountry>
    </RequireAuth>
  );
}
