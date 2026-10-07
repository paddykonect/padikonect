export type VenueCategory = "RESTAURANT" | "LOUNGE" | "REGISTERED_LOUNGE" | "BAR" | "ROOFTOP" | "CAFE";

export interface Venue {
  id: string;
  name: string;
  category: VenueCategory;
  addressText: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  isFavorite: boolean;
}

export interface VenueReview {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string | null; photoUrl: string | null };
}

export interface VenueDetail extends Venue {
  description: string | null;
  phone: string | null;
  photos: string[];
  amenities: string[];
  /** Lagos time, "HH:mm". */
  opensAt: string | null;
  closesAt: string | null;
  rating: { average: number | null; count: number };
  menu: Array<{ section: string; items: Array<{ id: string; name: string; priceKobo: number }> }>;
  reviews: VenueReview[];
  myReview: { rating: number; body: string } | null;
}

export const VENUE_CATEGORY_LABEL: Record<VenueCategory, string> = {
  RESTAURANT: "Restaurant",
  LOUNGE: "Lounge",
  REGISTERED_LOUNGE: "Registered lounge",
  BAR: "Bar",
  ROOFTOP: "Rooftop",
  CAFE: "Café",
};

export const VENUE_CATEGORY_EMOJI: Record<VenueCategory, string> = {
  RESTAURANT: "🍽️",
  LOUNGE: "🍹",
  REGISTERED_LOUNGE: "🎶",
  BAR: "🍸",
  ROOFTOP: "🌇",
  CAFE: "🌳",
};
