import { apiRequest } from "@/lib/api/client";
import { SignedUploadParams } from "@/lib/media/cloudinary";
import {
  CheckInResult,
  EntryPass,
  EventDetail,
  EventFilters,
  EventInput,
  EventListItem,
  EventPerson,
  InviteCandidate,
  JoinRequest,
  JoinRequestDetail,
  MyRsvp,
  RsvpStatus,
  VenueRequest,
} from "./types";

export function listEvents(accessToken: string, filters: EventFilters = {}) {
  const qs = new URLSearchParams({ limit: "50" });
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) qs.set(key, value.join(","));
    } else qs.set(key, String(value));
  }
  return apiRequest<{ items: EventListItem[]; nextCursor: string | null }>(`/events?${qs}`, {
    method: "GET",
    accessToken,
  });
}

/** Hangouts you host or were approved for (Profile "Your hangouts"). */
export function listMyEvents(accessToken: string) {
  return apiRequest<EventListItem[]>("/events/mine", { method: "GET", accessToken });
}

export function getEvent(accessToken: string, id: string) {
  return apiRequest<EventDetail>(`/events/${id}`, { method: "GET", accessToken });
}

/** Ask to join; the host approves (or it lands on the waitlist when full). */
export function joinEvent(accessToken: string, id: string, message?: string) {
  return apiRequest<{ status: RsvpStatus }>(`/events/${id}/rsvps`, { body: message ? { message } : {}, accessToken });
}

export function leaveEvent(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/events/${id}/rsvps/me`, { method: "DELETE", accessToken });
}

/** Save/unsave a hangout (the heart on a hangout card). */
export function setEventFavorite(accessToken: string, id: string, favorite: boolean) {
  return apiRequest<{ message: string }>(`/events/${id}/favorite`, { method: favorite ? "PUT" : "DELETE", accessToken });
}

/** The user's saved hangouts, for the Home "Favorites" row. */
export function listFavoriteEvents(accessToken: string) {
  return apiRequest<EventListItem[]>("/events/favorites", { method: "GET", accessToken });
}

export function createEvent(accessToken: string, input: EventInput) {
  return apiRequest<EventDetail>("/events", { body: input, accessToken });
}

export function updateEvent(accessToken: string, id: string, input: Partial<EventInput>) {
  return apiRequest<EventDetail>(`/events/${id}`, { method: "PATCH", body: input, accessToken });
}

export function getCoverUploadSignature(accessToken: string) {
  return apiRequest<SignedUploadParams>("/events/cover-upload-signature", { method: "GET", accessToken });
}

/** "Send in-app message" on Confirm with venue. */
export function requestVenueConfirmation(accessToken: string, id: string) {
  return apiRequest<{ venueRequestedAt: string }>(`/events/${id}/venue-request`, { method: "POST", accessToken });
}

export function listInviteCandidates(accessToken: string, id: string) {
  return apiRequest<InviteCandidate[]>(`/events/${id}/invite-candidates`, { method: "GET", accessToken });
}

export function invitePadis(accessToken: string, id: string, userIds: string[]) {
  return apiRequest<{ invited: number }>(`/events/${id}/invites`, { body: { userIds }, accessToken });
}

export function listJoinRequests(accessToken: string, id: string) {
  return apiRequest<JoinRequest[]>(`/events/${id}/rsvps`, { method: "GET", accessToken });
}

export function getJoinRequest(accessToken: string, id: string, userId: string) {
  return apiRequest<JoinRequestDetail>(`/events/${id}/rsvps/${userId}`, { method: "GET", accessToken });
}

export function decideJoinRequest(accessToken: string, id: string, userId: string, decision: "approve" | "decline", note?: string) {
  return apiRequest<{ status: RsvpStatus }>(`/events/${id}/rsvps/${userId}/${decision}`, {
    body: note?.trim() ? { note: note.trim() } : {},
    accessToken,
  });
}

export function getEntryPass(accessToken: string, id: string) {
  return apiRequest<EntryPass>(`/events/${id}/rsvps/me/pass`, { method: "GET", accessToken });
}

export function checkInPass(accessToken: string, id: string, code: string) {
  return apiRequest<CheckInResult>(`/events/${id}/rsvps/check-in`, { body: { code }, accessToken });
}

export function listAttendees(accessToken: string, id: string) {
  return apiRequest<EventPerson[]>(`/events/${id}/attendees`, { method: "GET", accessToken });
}

export function cancelEvent(accessToken: string, id: string, reason?: string) {
  return apiRequest<EventDetail>(`/events/${id}/cancel`, { body: reason?.trim() ? { reason: reason.trim() } : {}, accessToken });
}

/** Every hangout the viewer has asked to join, is waitlisted for, or is going to. */
export function listMyRsvps(accessToken: string) {
  return apiRequest<MyRsvp[]>("/rsvps/me", { method: "GET", accessToken });
}

/** Admin only: venue confirmation queue. */
export function listVenueRequests(accessToken: string) {
  return apiRequest<VenueRequest[]>("/events/venue-requests", { method: "GET", accessToken });
}

/** Admin only: answer for the venue. */
export function respondForVenue(accessToken: string, id: string, decision: "CONFIRMED" | "REJECTED", note?: string) {
  return apiRequest<{ venueApproval: string }>(`/events/${id}/venue-response`, {
    body: { decision, ...(note?.trim() && { note: note.trim() }) },
    accessToken,
  });
}
