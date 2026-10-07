import { VenueCategory } from "@/features/venues/types";

export type RsvpStatus = "REQUESTED" | "APPROVED" | "DECLINED" | "WAITLISTED" | "CANCELLED" | "ATTENDED";

export interface EventListItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  addressText: string;
  latitude: number;
  longitude: number;
  startAt: string;
  endAt: string | null;
  capacity: number;
  attendeeCount: number;
  priceKobo: number | null;
  drinkCategory: "ALCOHOLIC" | "NON_ALCOHOLIC" | "BOTH";
  tags: string[];
  status: string;
  isEnded: boolean;
  host: { id: string; displayName: string | null; photoUrl: string | null };
  /** The viewer's own RSVP (null = not joined, or cancelled). */
  myRsvpStatus: RsvpStatus | null;
  /** How many of the viewer's padis are going. */
  padiCount: number;
  /** Whether the viewer has saved this hangout (the card's heart). */
  isFavorite: boolean;
}

export interface EventPerson {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
}

export type EventPrivacy = "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
export type DrinkCategory = EventListItem["drinkCategory"];
/** Hangouts at a listed venue wait for it to confirm before going live. */
export type VenueApproval = "NOT_REQUIRED" | "PENDING" | "CONFIRMED" | "REJECTED";

export interface EventVenue {
  id: string;
  name: string;
  category: VenueCategory;
  addressText: string;
  phone: string | null;
  coverImageUrl: string | null;
}

export interface EventDetail extends EventListItem {
  description: string | null;
  privacy: EventPrivacy;
  cancelReason: string | null;
  isHost: boolean;
  attendeePreview: EventPerson[];
  /** Join requests waiting on the host; 0 for everyone else. */
  pendingRequestCount: number;
  venue: EventVenue | null;
  venueApproval: VenueApproval;
  venueRequestedAt: string | null;
  venueNote: string | null;
}

export interface EventInput {
  title: string;
  description?: string;
  addressText: string;
  latitude?: number;
  longitude?: number;
  venueId?: string;
  startAt: string;
  capacity: number;
  coverImageUrl?: string;
  drinkCategory?: DrinkCategory;
  privacy?: EventPrivacy;
}

export interface InviteCandidate {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  state: string | null;
  mutualHangouts: number;
  invited: boolean;
  joined: boolean;
}

export interface JoinRequest {
  rsvpId: string;
  status: RsvpStatus;
  waitlistPosition: number | null;
  message: string | null;
  createdAt: string;
  user: EventPerson;
}

export interface JoinRequestDetail extends JoinRequest {
  user: EventPerson & { state: string | null; memberSince: string; mutualHangouts: number };
}

export interface EntryPass {
  passCode: string;
  status: RsvpStatus;
  checkedInAt: string | null;
  decisionNote: string | null;
}

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  user: EventPerson;
}

export interface EventFilters {
  q?: string;
  tonight?: boolean;
  today?: boolean;
  nonAlcoholic?: boolean;
  underTwoK?: boolean;
  walkingDistance?: boolean;
  tags?: string[];
  lat?: number;
  lng?: number;
  venueId?: string;
}

export interface MyRsvp {
  rsvpStatus: RsvpStatus;
  event: { id: string; title: string; coverImageUrl: string | null; startAt: string; addressText: string };
}

export interface VenueRequest {
  eventId: string;
  title: string;
  startAt: string;
  capacity: number;
  venueApproval: VenueApproval;
  venueRequestedAt: string | null;
  venueRespondedAt: string | null;
  venueNote: string | null;
  venue: { id: string; name: string; addressText: string; phone: string | null };
  host: EventPerson;
}
