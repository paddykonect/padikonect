import { apiRequest } from "@/lib/api/client";
import { Venue, VenueCategory, VenueDetail } from "./types";

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function listVenues(accessToken: string, options: { category?: VenueCategory; q?: string } = {}) {
  const qs = new URLSearchParams({ limit: "50", ...(options.category && { category: options.category }), ...(options.q && { q: options.q }) });
  return apiRequest<Page<Venue>>(`/venues?${qs}`, { method: "GET", accessToken });
}

export function listFavoriteVenues(accessToken: string) {
  return apiRequest<Venue[]>("/venues/favorites", { method: "GET", accessToken });
}

export function setFavorite(accessToken: string, venueId: string, favorite: boolean) {
  return apiRequest<{ message: string }>(`/venues/${venueId}/favorite`, {
    method: favorite ? "PUT" : "DELETE",
    accessToken,
  });
}

export function getVenue(accessToken: string, venueId: string) {
  return apiRequest<VenueDetail>(`/venues/${venueId}`, { method: "GET", accessToken });
}

export function reviewVenue(accessToken: string, venueId: string, input: { rating: number; body: string }) {
  return apiRequest<{ message: string }>(`/venues/${venueId}/reviews`, { body: input, accessToken });
}
