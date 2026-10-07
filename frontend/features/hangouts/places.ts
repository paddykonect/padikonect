import { EventListItem } from "@/features/events/types";
import { Venue } from "@/features/venues/types";

/** A pin/card on the Hangout screens: either a hangout or a place. */
export type Place = { kind: "event"; key: string; event: EventListItem } | { kind: "venue"; key: string; venue: Venue };

export function toPlaces(events: EventListItem[], venues: Venue[]): Place[] {
  return [
    ...events.map((event): Place => ({ kind: "event", key: `event:${event.id}`, event })),
    ...venues.map((venue): Place => ({ kind: "venue", key: `venue:${venue.id}`, venue })),
  ];
}

export function placeCoords(p: Place): [number, number] {
  return p.kind === "event" ? [p.event.latitude, p.event.longitude] : [p.venue.latitude, p.venue.longitude];
}

export function distanceMeters([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a));
}

/** "0.4km", "12km" */
export function formatDistance(meters: number) {
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
}

/** Google Maps turn-by-turn directions to a point. */
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function shortClock(date: Date) {
  return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[AP]M$/, "");
}

/** Cover badge, e.g. "Starts in 2 hrs", "Tonight by 7:30", "Sat by 12:30". Null beyond a week. */
export function startBadge(startAt: string, now = new Date()): string | null {
  const start = new Date(startAt);
  const minutes = Math.round((start.getTime() - now.getTime()) / 60000);
  if (minutes < 0) return null;
  if (minutes < 60) return `Starts in ${Math.max(1, minutes)} min`;
  if (minutes < 180) {
    const hours = Math.round(minutes / 60);
    return `Starts in ${hours} hr${hours === 1 ? "" : "s"}`;
  }
  if (start.toDateString() === now.toDateString()) {
    return `${start.getHours() >= 17 ? "Tonight" : "Today"} by ${shortClock(start)}`;
  }
  if (minutes < 6 * 24 * 60) return `${start.toLocaleString("en-US", { weekday: "short" })} by ${shortClock(start)}`;
  return null;
}

/** "11 going · 3 padis" */
export function goingLabel(event: Pick<EventListItem, "attendeeCount" | "padiCount">) {
  const padis = event.padiCount > 0 ? ` · ${event.padiCount} padi${event.padiCount === 1 ? "" : "s"}` : "";
  return `${event.attendeeCount} going${padis}`;
}

/** Card pill for the viewer's relationship to a hangout; null means they can join. */
export function rsvpLabel(event: EventListItem, userId: string | undefined): string | null {
  if (userId && event.host.id === userId) return "Hosting";
  switch (event.myRsvpStatus) {
    case "APPROVED":
    case "ATTENDED":
      return "Going";
    case "REQUESTED":
      return "Requested";
    case "WAITLISTED":
      return "Waitlisted";
    case "DECLINED":
      return "Declined";
    default:
      return null;
  }
}

/** The user's position, but only if they've already granted location — never prompts. */
export async function getGrantedPosition(): Promise<[number, number] | null> {
  try {
    if (!navigator.permissions || !("geolocation" in navigator)) return null;
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state !== "granted") return null;
    return await new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolve([p.coords.latitude, p.coords.longitude]),
        () => resolve(null),
        { timeout: 10_000 },
      ),
    );
  } catch {
    return null;
  }
}
