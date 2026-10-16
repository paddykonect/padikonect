import { apiRequest } from "@/lib/api/client";
import { SignedUploadParams } from "@/lib/media/cloudinary";
import {
  Community,
  CommunityDetail,
  CommunityEvent,
  CommunityMember,
  CreateCommunityInput,
} from "./types";

export function listCommunities(accessToken: string, mine = false) {
  return apiRequest<Community[]>(`/communities${mine ? "?mine=true" : ""}`, { method: "GET", accessToken });
}

export function listFavoriteCommunities(accessToken: string) {
  return apiRequest<Community[]>("/communities/favorites", { method: "GET", accessToken });
}

export function getCommunity(accessToken: string, id: string) {
  return apiRequest<CommunityDetail>(`/communities/${id}`, { method: "GET", accessToken });
}

export function listCommunityMembers(accessToken: string, id: string) {
  return apiRequest<CommunityMember[]>(`/communities/${id}/members`, { method: "GET", accessToken });
}

export function listCommunityEvents(accessToken: string, id: string) {
  return apiRequest<CommunityEvent[]>(`/communities/${id}/events`, { method: "GET", accessToken });
}

export function createCommunity(accessToken: string, input: CreateCommunityInput) {
  return apiRequest<Community>("/communities", { body: input, accessToken });
}

export function joinCommunity(accessToken: string, id: string) {
  return apiRequest<Community>(`/communities/${id}/join`, { method: "POST", body: {}, accessToken });
}

export function leaveCommunity(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/communities/${id}/membership`, { method: "DELETE", accessToken });
}

/** The heart on a community card. */
export function setCommunityFavorite(accessToken: string, id: string, favorite: boolean) {
  return apiRequest<{ message: string }>(`/communities/${id}/favorite`, { method: favorite ? "PUT" : "DELETE", accessToken });
}

export function reportCommunity(accessToken: string, id: string, reason?: string) {
  return apiRequest<{ message: string }>(`/communities/${id}/report`, {
    body: reason?.trim() ? { reason: reason.trim() } : {},
    accessToken,
  });
}

export function getCoverUploadSignature(accessToken: string) {
  return apiRequest<SignedUploadParams>("/communities/cover-upload-signature", { method: "GET", accessToken });
}
